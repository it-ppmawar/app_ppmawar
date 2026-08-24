import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    // Waktu & Tanggal Akurat Asia/Jakarta (WIB)
    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentTimeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour12: false }).format(new Date());
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
          SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi
        WHERE tanggal = ?
      `, [todayStr]);
      madinStatsRow = rows[0] || {};
    } catch (e) {
      console.warn('madinStats error:', e);
    }

    let quranStatsRow: any = {};
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_quran
        WHERE tanggal = ?
      `, [todayStr]);
      quranStatsRow = rows[0] || {};
    } catch (e) {
      console.warn('quranStats error:', e);
    }

    let kegiatanStatsRow: any = {};
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_kegiatan
        WHERE tanggal = ?
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

    // 4. PERIZINAN TERBARU (Hari Ini atau 7 Hari Terakhir) (Safe try/catch)
    let perizinanRows: any[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT m.nama, m.nis, k.nama_kelas as kelas, a.status, a.keterangan, a.tanggal, 'madin' as sumber
        FROM absensi a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_madin k ON m.kelas_madin_id = k.kelas_id
        WHERE a.status IN ('Izin','Sakit') AND a.tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        UNION ALL
        SELECT m.nama, m.nis, k.nama_kelas as kelas, a.status, a.keterangan, a.tanggal, 'quran' as sumber
        FROM absensi_quran a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_quran k ON m.kelas_quran_id = k.id
        WHERE a.status IN ('Izin','Sakit') AND a.tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        UNION ALL
        SELECT m.nama, m.nis, km.nama_kamar as kelas, a.status, a.keterangan, a.tanggal, 'kegiatan' as sumber
        FROM absensi_kegiatan a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kamar km ON m.kamar_id = km.kamar_id
        WHERE a.status IN ('Izin','Sakit') AND a.tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ORDER BY tanggal DESC, nama ASC
        LIMIT 30
      `);
      perizinanRows = rows;
    } catch (e) {
      console.warn('perizinan query error:', e);
    }

    // 5. PELANGGARAN / ALPA TERBARU (Hari Ini atau 7 Hari Terakhir) (Safe try/catch)
    let pelanggaranRows: any[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`
        SELECT m.nama, m.nis, k.nama_kelas as kelas, a.status, a.keterangan, a.tanggal, 'madin' as sumber
        FROM absensi a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_madin k ON m.kelas_madin_id = k.kelas_id
        WHERE a.status IN ('Alpha', 'Alpa') AND a.tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        UNION ALL
        SELECT m.nama, m.nis, k.nama_kelas as kelas, a.status, a.keterangan, a.tanggal, 'quran' as sumber
        FROM absensi_quran a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_quran k ON m.kelas_quran_id = k.id
        WHERE a.status IN ('Alpha', 'Alpa') AND a.tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        UNION ALL
        SELECT m.nama, m.nis, km.nama_kamar as kelas, a.status, a.keterangan, a.tanggal, 'kegiatan' as sumber
        FROM absensi_kegiatan a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kamar km ON m.kamar_id = km.kamar_id
        WHERE a.status IN ('Alpha', 'Alpa') AND a.tanggal >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ORDER BY tanggal DESC, nama ASC
        LIMIT 30
      `);
      pelanggaranRows = rows;
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
      perizinanTerbaru: perizinanRows,
      pelanggaranTerbaru: pelanggaranRows,
    });

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
    }, { status: 200 });
  }
}