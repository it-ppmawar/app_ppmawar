import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noCacheHeaders = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noCacheHeaders });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401, headers: noCacheHeaders });

    // Resolve namaAsrama untuk filter gender staff putra/putri
    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const resolvedAsrama = await resolveAsrama(payload.userId, payload.role, payload.username || '', payload.namaAsrama || null);

    // Tentukan filter gender untuk staff putra/putri
    let genderFilter: string | null = null;
    if (payload.role === 'staff' && resolvedAsrama) {
      const asr = resolvedAsrama.toLowerCase();
      if (asr === 'putra' || asr.includes('putra') || asr.includes('asrama a') || asr === 'a') {
        genderFilter = 'Laki-laki';
      } else if (asr === 'putri' || asr.includes('putri') || asr.includes('asrama b') || asr.includes('asrama c') || asr.includes('asrama d') || asr.includes('asrama e') || asr.includes('asrama f') || ['b', 'c', 'd', 'e', 'f'].includes(asr.trim())) {
        genderFilter = 'Perempuan';
      }
    }
    // Klausa gender filter untuk WHERE atau AND
    const genderWhereJoin = genderFilter ? ` JOIN murid mgf ON mgf.murid_id = a.murid_id AND mgf.jenis_kelamin = '${genderFilter}'` : '';
    const genderWhereJoinAq = genderFilter ? ` JOIN murid mgf ON mgf.murid_id = aq.murid_id AND mgf.jenis_kelamin = '${genderFilter}'` : '';
    const genderWhereJoinAk = genderFilter ? ` JOIN murid mgf ON mgf.murid_id = ak.murid_id AND mgf.jenis_kelamin = '${genderFilter}'` : '';

    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentTimeStr = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }); // HH:mm:ss WIB
    const rawDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentDay = rawDay === 'Minggu' ? 'Ahad' : rawDay;


    // 1. Ambil pengaturan absensi otomatis (Safe try/catch)
    let settings: Record<string, any> = {};
    try {
      const [settingRows] = await pool.execute<RowDataPacket[]>(
        "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('absensi_otomatis', 'absensi_otomatis_guru', 'absensi_otomatis_madin', 'absensi_otomatis_quran', 'absensi_otomatis_kegiatan', 'waktu_tenggang', 'waktu_tenggang_absensi', 'mode_libur')"
      );
      settingRows.forEach(r => { settings[r.nama_pengaturan] = r.nilai; });
    } catch (e) {
      console.warn('Pengaturan absensi error:', e);
    }

    const isAutoAbsenGlobal = settings['absensi_otomatis'] === '1' || settings['absensi_otomatis_guru'] === '1' || settings['absensi_otomatis'] === 'true' || settings['absensi_otomatis'] === 1;
    const isAutoAbsenMadin = isAutoAbsenGlobal && (settings['absensi_otomatis_madin'] !== '0');
    const isAutoAbsenQuran = isAutoAbsenGlobal && (settings['absensi_otomatis_quran'] === '1' || settings['absensi_otomatis_quran'] === 'true');
    const isAutoAbsenKegiatan = isAutoAbsenGlobal && (settings['absensi_otomatis_kegiatan'] === '1' || settings['absensi_otomatis_kegiatan'] === 'true');

    const isModeLibur = settings['mode_libur'] === '1' || settings['mode_libur'] === 'true' || settings['mode_libur'] === 1;
    const waktuTenggangHours = parseFloat(settings['waktu_tenggang'] || settings['waktu_tenggang_absensi'] || '2') || 2;

    // Helper untuk konversi HH:mm:ss ke detik
    const parseTimeToSec = (t: string) => {
      if (!t) return 0;
      const [h, m, s] = t.split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };
    const currentSecs = parseTimeToSec(currentTimeStr);

    // 2. STATISTIK GURU HARI INI (Safe try/catch)
    let jadwalGuruRows: RowDataPacket[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT j.jadwal_id, j.guru_id, j.jam_mulai, j.jam_selesai, 'madin' as tipe
        FROM jadwal_madin j WHERE j.hari = ? AND j.guru_id IS NOT NULL AND j.guru_id > 0
        UNION ALL
        SELECT j.id as jadwal_id, j.guru_id, j.jam_mulai, j.jam_selesai, 'quran' as tipe
        FROM jadwal_quran j WHERE j.hari = ? AND j.guru_id IS NOT NULL AND j.guru_id > 0
        UNION ALL
        SELECT j.kegiatan_id as jadwal_id, j.guru_id, j.jam_mulai, j.jam_selesai, 'kegiatan' as tipe
        FROM jadwal_kegiatan j WHERE j.hari = ? AND j.guru_id IS NOT NULL AND j.guru_id > 0
      `, [currentDay, currentDay, currentDay]);
      jadwalGuruRows = rows;
    } catch (e) {
      console.warn('jadwalGuruRows error:', e);
    }

    let absenGuruRows: RowDataPacket[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT ag.guru_id, ag.status, ag.jadwal_madin_id, ag.jadwal_quran_id, ag.kegiatan_id
        FROM absensi_guru ag
        WHERE ag.tanggal = ?
      `, [todayStr]);
      absenGuruRows = rows;
    } catch (e) {
      console.warn('absenGuruRows error:', e);
    }

    // Helper kalkulasi statistik guru per kategori jadwal
    const calcCategoryGuruStats = (categoryRows: any[], categoryKey: 'madin' | 'quran' | 'kegiatan') => {
      const distinctIds = Array.from(new Set(categoryRows.map(j => j.guru_id)));
      let hadir = 0, izin = 0, sakit = 0, alpha = 0;

      let isCatAutoActive = false;
      if (categoryKey === 'madin') isCatAutoActive = isAutoAbsenMadin;
      else if (categoryKey === 'quran') isCatAutoActive = isAutoAbsenQuran;
      else if (categoryKey === 'kegiatan') isCatAutoActive = isAutoAbsenKegiatan;

      distinctIds.forEach(gId => {
        const guruAbsens = absenGuruRows.filter(a => a.guru_id === gId);
        const specificAbsen = guruAbsens.find(a => {
          if (categoryKey === 'madin') return a.jadwal_madin_id !== null && a.jadwal_madin_id !== undefined;
          if (categoryKey === 'quran') return a.jadwal_quran_id !== null && a.jadwal_quran_id !== undefined;
          if (categoryKey === 'kegiatan') return a.kegiatan_id !== null && a.kegiatan_id !== undefined;
          return true;
        }) || guruAbsens[0];

        const recordedStatus = specificAbsen?.status;
        if (recordedStatus === 'Hadir') hadir++;
        else if (recordedStatus === 'Izin') izin++;
        else if (recordedStatus === 'Sakit') sakit++;
        else if (recordedStatus === 'Alpha') alpha++;
        else {
          if (isCatAutoActive && !isModeLibur) {
            const schedules = categoryRows.filter(j => j.guru_id === gId);
            const allPassed = schedules.length > 0 && schedules.every(s => {
              const selesaiSec = parseTimeToSec(s.jam_selesai);
              const deadlineSec = selesaiSec + (waktuTenggangHours * 3600);
              return currentSecs > deadlineSec;
            });
            if (allPassed) alpha++;
          }
        }
      });

      return {
        total: distinctIds.length,
        hadir,
        izin,
        sakit,
        alpha
      };
    };

    const madinGuruSchedules = jadwalGuruRows.filter(j => j.tipe === 'madin');
    const quranGuruSchedules = jadwalGuruRows.filter(j => j.tipe === 'quran');
    const kegiatanGuruSchedules = jadwalGuruRows.filter(j => j.tipe === 'kegiatan');

    const guruMadin = calcCategoryGuruStats(madinGuruSchedules, 'madin');
    const guruQuran = calcCategoryGuruStats(quranGuruSchedules, 'quran');
    const guruKegiatan = calcCategoryGuruStats(kegiatanGuruSchedules, 'kegiatan');

    const allGuruDistinctIds = Array.from(new Set(jadwalGuruRows.map(j => j.guru_id)));
    const guruOverall = {
      total: allGuruDistinctIds.length,
      hadir: guruMadin.hadir + guruQuran.hadir + guruKegiatan.hadir,
      izin: guruMadin.izin + guruQuran.izin + guruKegiatan.izin,
      sakit: guruMadin.sakit + guruQuran.sakit + guruKegiatan.sakit,
      alpha: guruMadin.alpha + guruQuran.alpha + guruKegiatan.alpha,
    };

    // 3. STATISTIK ABSENSI SANTRI HARI INI (Safe try/catch)
    let madinStatsRow: any = {};
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi a${genderWhereJoin}
        WHERE a.tanggal = ?
      `, [todayStr]);
      madinStatsRow = rows[0] || {};
    } catch (e) {
      console.warn('madinStats error:', e);
    }

    let quranStatsRow: any = {};
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          SUM(CASE WHEN LOWER(aq.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(aq.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(aq.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(aq.status) IN ('alpha', 'alpa') OR aq.status = '' OR aq.status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_quran aq${genderWhereJoinAq}
        WHERE aq.tanggal = ?
      `, [todayStr]);
      quranStatsRow = rows[0] || {};
    } catch (e) {
      console.warn('quranStats error:', e);
    }

    let kegiatanStatsRow: any = {};
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          SUM(CASE WHEN LOWER(ak.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(ak.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(ak.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(ak.status) IN ('alpha', 'alpa') OR ak.status = '' OR ak.status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_kegiatan ak${genderWhereJoinAk}
        WHERE ak.tanggal = ?
      `, [todayStr]);
      kegiatanStatsRow = rows[0] || {};
    } catch (e) {
      console.warn('kegiatanStats error:', e);
    }


    const formatStatObj = (row: any) => {
      const hadir = Number(row?.hadir || 0);
      const izin = Number(row?.izin || 0);
      const sakit = Number(row?.sakit || 0);
      const alpha = Number(row?.alpha || 0);
      const total = hadir + izin + sakit + alpha;

      const calcPct = (val: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

      return {
        total,
        hadir,
        izin,
        sakit,
        alpha,
        hadirPct: calcPct(hadir),
        izinPct: calcPct(izin),
        sakitPct: calcPct(sakit),
        alphaPct: calcPct(alpha),
      };
    };

    // Helper mapper untuk baris santri
    const mapSantriRow = (r: any, sumber: string, defaultStatus: string) => {
      let statusClean = defaultStatus;
      const rawStatus = (r.status || '').toLowerCase();
      if (rawStatus.includes('sakit')) statusClean = 'Sakit';
      else if (rawStatus.includes('izin')) statusClean = 'Izin';
      else if (rawStatus.includes('alph') || rawStatus.includes('alp')) statusClean = 'Alpha';

      let rawTgl = '';
      if (r.tanggal) {
        if (r.tanggal instanceof Date) {
          rawTgl = r.tanggal.toISOString().slice(0, 10);
        } else {
          rawTgl = String(r.tanggal).slice(0, 10);
        }
      }

      return {
        nama: r.nama || '-',
        kelas: r.kelas_nama || '-',
        status: statusClean,
        keterangan: r.keterangan || '',
        tanggal: rawTgl,
        sumber,
      };
    };

    // 4. PERIZINAN TERBARU (Hari ini & 1 hari sebelumnya saja, tanpa limit baris)
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(yesterdayDate);
    const targetDates = [todayStr, yesterdayStr];
    const datePlaceholders = targetDates.map(() => '?').join(', ');
    const genderCondition = genderFilter ? ` AND m.jenis_kelamin = ?` : '';
    const queryTargetParams = genderFilter ? [...targetDates, genderFilter] : targetDates;

    let perizinanRows: any[] = [];
    try {
      const [madinRows, quranRows, kegiatanRows, pelanggaranRows] = await Promise.all([
        pool.execute<RowDataPacket[]>(
          `SELECT a.murid_id, m.nama, a.tanggal, a.keterangan, a.status,
                  COALESCE(km.nama_kelas, '-') as kelas_nama
           FROM absensi a 
           JOIN murid m ON a.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           WHERE LOWER(a.status) IN ('izin', 'sakit') AND a.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY a.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
        pool.execute<RowDataPacket[]>(
          `SELECT aq.murid_id, m.nama, aq.tanggal, aq.keterangan, aq.status,
                  COALESCE(kq.nama_kelas, '-') as kelas_nama
           FROM absensi_quran aq 
           JOIN murid m ON aq.murid_id = m.murid_id 
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE LOWER(aq.status) IN ('izin', 'sakit') AND aq.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY aq.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
        pool.execute<RowDataPacket[]>(
          `SELECT ak.murid_id, m.nama, ak.tanggal, ak.keterangan, ak.status,
                  COALESCE(ka.nama_kamar, '-') as kelas_nama
           FROM absensi_kegiatan ak 
           JOIN murid m ON ak.murid_id = m.murid_id 
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE LOWER(ak.status) IN ('izin', 'sakit') AND ak.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY ak.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
        pool.execute<RowDataPacket[]>(
          `SELECT p.pelanggaran_id, p.murid_id, m.nama, p.tanggal, p.deskripsi as keterangan, p.jenis as status,
                  COALESCE(km.nama_kelas, kq.nama_kelas, ka.nama_kamar, '-') as kelas_nama
           FROM pelanggaran p 
           JOIN murid m ON p.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE (LOWER(p.jenis) LIKE '%izin%' OR LOWER(p.jenis) LIKE '%sakit%') AND p.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY p.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
      ]);

      // Helper sorting berjenjang: Status/Jenis -> Kelas -> Abjad Nama -> Tanggal
      const sortSantriList = (list: any[]) => {
        const statusOrder: Record<string, number> = { 'Izin': 1, 'Sakit': 2, 'Alpha': 3 };
        return list.sort((a, b) => {
          // 1. Status / Jenis (Izin -> Sakit -> Alpha)
          const orderA = statusOrder[a.status] || 99;
          const orderB = statusOrder[b.status] || 99;
          if (orderA !== orderB) return orderA - orderB;

          // 2. Kelas (Natural sort A-Z dan angka tingkat)
          const kelasComp = (a.kelas || '').localeCompare(b.kelas || '', 'id', { numeric: true, sensitivity: 'base' });
          if (kelasComp !== 0) return kelasComp;

          // 3. Abjad Nama Santri (A-Z)
          const namaComp = (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' });
          if (namaComp !== 0) return namaComp;

          // 4. Tanggal (Terbaru di atas)
          return (b.tanggal || '').localeCompare(a.tanggal || '');
        });
      };

      perizinanRows = sortSantriList([
        ...((madinRows[0] || []).map((r: any) => mapSantriRow(r, 'Madin', 'Izin'))),
        ...((quranRows[0] || []).map((r: any) => mapSantriRow(r, "Qur'an", 'Izin'))),
        ...((kegiatanRows[0] || []).map((r: any) => mapSantriRow(r, 'Kegiatan', 'Izin'))),
        ...((pelanggaranRows[0] || []).map((r: any) => mapSantriRow(r, 'Perizinan', 'Izin'))),
      ]);
    } catch (e) {
      console.warn('perizinan query error:', e);
    }

    // 5. PELANGGARAN TERBARU (Rekapitulasi Absensi Alpa + Pelanggaran Ketertiban Lainnya, 1 hari terakhir)
    let pelanggaranRows: any[] = [];
    try {
      const [madinRows, quranRows, kegiatanRows, pelanggaranRowsDb] = await Promise.all([
        pool.execute<RowDataPacket[]>(
          `SELECT a.murid_id, m.nama, a.tanggal, a.keterangan, a.status,
                  COALESCE(km.nama_kelas, '-') as kelas_nama
           FROM absensi a 
           JOIN murid m ON a.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           WHERE (LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL) AND a.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY a.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
        pool.execute<RowDataPacket[]>(
          `SELECT aq.murid_id, m.nama, aq.tanggal, aq.keterangan, aq.status,
                  COALESCE(kq.nama_kelas, '-') as kelas_nama
           FROM absensi_quran aq 
           JOIN murid m ON aq.murid_id = m.murid_id 
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE (LOWER(aq.status) IN ('alpha', 'alpa') OR aq.status = '' OR aq.status IS NULL) AND aq.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY aq.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
        pool.execute<RowDataPacket[]>(
          `SELECT ak.murid_id, m.nama, ak.tanggal, ak.keterangan, ak.status,
                  COALESCE(ka.nama_kamar, '-') as kelas_nama
           FROM absensi_kegiatan ak 
           JOIN murid m ON ak.murid_id = m.murid_id 
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE (LOWER(ak.status) IN ('alpha', 'alpa') OR ak.status = '' OR ak.status IS NULL) AND ak.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY ak.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
        pool.execute<RowDataPacket[]>(
          `SELECT p.pelanggaran_id, p.murid_id, m.nama, p.tanggal, p.deskripsi as keterangan, p.jenis as status,
                  COALESCE(km.nama_kelas, kq.nama_kelas, ka.nama_kamar, '-') as kelas_nama
           FROM pelanggaran p 
           JOIN murid m ON p.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE (LOWER(p.jenis) NOT LIKE '%izin%' AND LOWER(p.jenis) NOT LIKE '%sakit%') AND p.tanggal IN (${datePlaceholders})${genderCondition}
           ORDER BY p.tanggal DESC, m.nama ASC`,
          queryTargetParams
        ).catch(() => [[] as RowDataPacket[]]),
      ]);

      const sortPelanggaranList = (list: any[]) => {
        const statusOrder: Record<string, number> = { 'Alpha': 1, 'Alpa': 1, '': 1 };
        return list.sort((a, b) => {
          // 1. Status (Alpha di atas, lainnya / Pelanggaran di bawah)
          const orderA = statusOrder[a.status] ?? 99;
          const orderB = statusOrder[b.status] ?? 99;
          if (orderA !== orderB) return orderA - orderB;

          // 2. Kelas (Natural sort A-Z dan angka tingkat)
          const kelasComp = (a.kelas || '').localeCompare(b.kelas || '', 'id', { numeric: true, sensitivity: 'base' });
          if (kelasComp !== 0) return kelasComp;

          // 3. Abjad Nama Santri (A-Z)
          const namaComp = (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' });
          if (namaComp !== 0) return namaComp;

          // 4. Tanggal (Terbaru di atas)
          return (b.tanggal || '').localeCompare(a.tanggal || '');
        });
      };

      pelanggaranRows = sortPelanggaranList([
        ...((madinRows[0] || []).map((r: any) => mapSantriRow(r, 'Madin', 'Alpha'))),
        ...((quranRows[0] || []).map((r: any) => mapSantriRow(r, "Qur'an", 'Alpha'))),
        ...((kegiatanRows[0] || []).map((r: any) => mapSantriRow(r, 'Kegiatan', 'Alpha'))),
        ...((pelanggaranRowsDb[0] || []).map((r: any) => mapSantriRow(r, 'Pelanggaran', r.status || 'Pelanggaran'))),
      ]);
    } catch (e) {
      console.warn('pelanggaran query error:', e);
    }

    return NextResponse.json({
      success: true,
      tanggal: todayStr,
      hari: currentDay,
      guru: {
        total: guruOverall,
        madin: guruMadin,
        quran: guruQuran,
        kegiatan: guruKegiatan,
      },
      santri: {
        madin: formatStatObj(madinStatsRow),
        quran: formatStatObj(quranStatsRow),
        kegiatan: formatStatObj(kegiatanStatsRow),
      },
      perizinanTerbaru: payload.role === 'tamu' ? [] : perizinanRows,
      pelanggaranTerbaru: payload.role === 'tamu' ? [] : pelanggaranRows,
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error('[dashboard/stats] Fatal Error:', error.message);
    return NextResponse.json({
      success: false,
      error: 'Server error: ' + error.message,
      guru: {
        total: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
        madin: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
        quran: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
        kegiatan: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
      },
      santri: {
        madin: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, hadirPct: 0, izinPct: 0, sakitPct: 0, alphaPct: 0 },
        quran: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, hadirPct: 0, izinPct: 0, sakitPct: 0, alphaPct: 0 },
        kegiatan: { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, hadirPct: 0, izinPct: 0, sakitPct: 0, alphaPct: 0 },
      },
      perizinanTerbaru: [],
      pelanggaranTerbaru: []
    }, { status: 200, headers: noCacheHeaders });
  }
}