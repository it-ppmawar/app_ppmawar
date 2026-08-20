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

    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    const nowLocal = new Date(Date.now() - tzOffset);
    const todayStr = nowLocal.toISOString().slice(0, 10);
    const currentTimeStr = nowLocal.toISOString().slice(11, 19);

    const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDay = days[nowLocal.getDay()];

    // 1. Ambil pengaturan absensi otomatis
    const [settingRows] = await pool.execute<RowDataPacket[]>(
      "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('absensi_otomatis', 'waktu_tenggang', 'mode_libur')"
    );
    const settings: Record<string, any> = {};
    settingRows.forEach(r => { settings[r.nama_pengaturan] = r.nilai; });

    const isAutoAbsenActive = settings['absensi_otomatis'] === '1' || settings['absensi_otomatis'] === 'true' || settings['absensi_otomatis'] === 1;
    const isModeLibur = settings['mode_libur'] === '1' || settings['mode_libur'] === 'true' || settings['mode_libur'] === 1;
    const waktuTenggangHours = parseFloat(settings['waktu_tenggang'] || '2') || 2;

    // Helper untuk konversi HH:mm:ss ke detik
    const parseTimeToSec = (t: string) => {
      if (!t) return 0;
      const [h, m, s] = t.split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };
    const currentSecs = parseTimeToSec(currentTimeStr);

    // 2. STATISTIK GURU HARI INI
    // Ambil semua jadwal guru hari ini
    const [jadwalGuruRows] = await pool.execute<RowDataPacket[]>(`
      SELECT j.jadwal_id, j.guru_id, j.jam_mulai, j.jam_selesai, 'madin' as tipe
      FROM jadwal_madin j WHERE j.hari = ? AND j.guru_id IS NOT NULL AND j.guru_id > 0
      UNION ALL
      SELECT j.id as jadwal_id, j.guru_id, j.jam_mulai, j.jam_selesai, 'quran' as tipe
      FROM jadwal_quran j WHERE j.hari = ? AND j.guru_id IS NOT NULL AND j.guru_id > 0
      UNION ALL
      SELECT j.kegiatan_id as jadwal_id, j.guru_id, j.jam_mulai, j.jam_selesai, 'kegiatan' as tipe
      FROM jadwal_kegiatan j WHERE j.hari = ? AND j.guru_id IS NOT NULL AND j.guru_id > 0
    `, [currentDay, currentDay, currentDay]);

    // Ambil data absensi_guru hari ini
    const [absenGuruRows] = await pool.execute<RowDataPacket[]>(`
      SELECT ag.guru_id, ag.status, ag.jadwal_madin_id, ag.jadwal_quran_id, ag.kegiatan_id
      FROM absensi_guru ag
      WHERE ag.tanggal = ?
    `, [todayStr]);

    const guruMapAbsen = new Map<number, string>();
    absenGuruRows.forEach(a => {
      guruMapAbsen.set(a.guru_id, a.status);
    });

    let totalGuruJadwal = 0;
    let guruHadir = 0;
    let guruIzin = 0;
    let guruSakit = 0;
    let guruAlpha = 0;

    // Hitung berdasarkan guru unik yang memiliki jadwal hari ini
    const distinctGuruIds = Array.from(new Set(jadwalGuruRows.map(j => j.guru_id)));
    totalGuruJadwal = distinctGuruIds.length;

    distinctGuruIds.forEach(gId => {
      const recordedStatus = guruMapAbsen.get(gId);
      if (recordedStatus === 'Hadir') {
        guruHadir++;
      } else if (recordedStatus === 'Izin') {
        guruIzin++;
      } else if (recordedStatus === 'Sakit') {
        guruSakit++;
      } else if (recordedStatus === 'Alpha') {
        guruAlpha++;
      } else {
        // Belum ada record absensi guru hari ini
        if (isAutoAbsenActive && !isModeLibur) {
          // Periksa apakah seluruh jadwal guru ini untuk hari ini telah melewati jam_selesai + waktu_tenggang
          const guruSchedules = jadwalGuruRows.filter(j => j.guru_id === gId);
          const allPassed = guruSchedules.length > 0 && guruSchedules.every(s => {
            const selesaiSec = parseTimeToSec(s.jam_selesai);
            const deadlineSec = selesaiSec + (waktuTenggangHours * 3600);
            return currentSecs > deadlineSec;
          });
          if (allPassed) {
            guruAlpha++;
          }
        }
      }
    });

    // 3. STATISTIK ABSENSI SANTRI HARI INI (Madin, Quran, Kegiatan)
    // a. Madin
    const [madinStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
        COUNT(*) as total
      FROM absensi
      WHERE tanggal = ?
    `, [todayStr]);

    // b. Quran
    const [quranStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
        COUNT(*) as total
      FROM absensi_quran
      WHERE tanggal = ?
    `, [todayStr]);

    // c. Kegiatan
    const [kegiatanStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
        COUNT(*) as total
      FROM absensi_kegiatan
      WHERE tanggal = ?
    `, [todayStr]);

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

    return NextResponse.json({
      success: true,
      tanggal: todayStr,
      hari: currentDay,
      guru: {
        total: totalGuruJadwal,
        hadir: guruHadir,
        izin: guruIzin,
        sakit: guruSakit,
        alpha: guruAlpha,
      },
      santri: {
        madin: formatStatObj(madinStats[0]),
        quran: formatStatObj(quranStats[0]),
        kegiatan: formatStatObj(kegiatanStats[0]),
      }
    });

  } catch (error: any) {
    console.error('[dashboard/stats] Error:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}