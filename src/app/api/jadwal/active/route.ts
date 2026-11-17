import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { createShortToken } from '@/lib/auth/shortToken';

export const dynamic = 'force-dynamic';

export async function GET() {
  const noCacheHeaders = {
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ success: true, activeSchedule: null }, { headers: noCacheHeaders });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ success: true, activeSchedule: null }, { headers: noCacheHeaders });

    const { role, guruId, kamarId } = payload as any;

    if (role === 'admin' || role === 'staff') {
      const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
      const resolvedAsrama = await resolveAsrama(payload.userId, role, payload.username || '', payload.namaAsrama || null);
      const { getActivePendingReminders } = await import('@/lib/jadwal/activeReminders');
      let pendingReminders = await getActivePendingReminders();

      if (role === 'staff' && resolvedAsrama) {
        const asr = resolvedAsrama.toLowerCase();
        if (asr === 'putra' || asr.includes('putra') || asr.includes('asrama a') || asr === 'a') {
          pendingReminders = pendingReminders.filter(r => {
            const k = (r.kelas_nama || '').toLowerCase();
            return k.includes('putra') || k.startsWith('a-') || k.startsWith('a ') || k === 'asrama a' || /^[a][0-9]/i.test(k);
          });
        } else if (asr === 'putri' || asr.includes('putri') || asr.includes('asrama b') || asr.includes('asrama c') || asr.includes('asrama d') || asr.includes('asrama e') || asr.includes('asrama f') || ['b', 'c', 'd', 'e', 'f'].includes(asr.trim())) {
          pendingReminders = pendingReminders.filter(r => {
            const k = (r.kelas_nama || '').toLowerCase();
            return k.includes('putri') || (!k.includes('putra') && !k.startsWith('a-') && !k.startsWith('a ') && k !== 'asrama a');
          });
        }
      }

      return NextResponse.json({
        success: true,
        activeSchedule: null,
        pendingRemindersCount: pendingReminders.length,
        data: pendingReminders
      }, { headers: noCacheHeaders });
    }

    const userRoleLower = (role || '').toLowerCase();
    let effGuruId = guruId;
    if (userRoleLower === 'guru' && !effGuruId) {
      try {
        const [gRows] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE user_id = ? LIMIT 1',
          [payload.userId]
        );
        if (gRows.length > 0) effGuruId = gRows[0].guru_id;
      } catch (_) {}
    }

    let effKamarId = kamarId;
    if ((userRoleLower === 'pengurus_asrama' || userRoleLower === 'pengasuh') && !effKamarId) {
      try {
        const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
        const asramaName = await resolveAsrama(payload.userId, role, payload.username || '', payload.namaAsrama || null);
        if (asramaName) {
          const [kRows] = await pool.execute<RowDataPacket[]>(
            'SELECT kamar_id FROM kamar WHERE nama_asrama = ? LIMIT 1',
            [asramaName]
          );
          if (kRows.length > 0) effKamarId = kRows[0].kamar_id;
        }
      } catch (_) {}
    }

    if ((userRoleLower === 'guru' && !effGuruId) || ((userRoleLower === 'pengurus_asrama' || userRoleLower === 'pengasuh') && !effKamarId)) {
      return NextResponse.json({ success: true, activeSchedule: null }, { headers: noCacheHeaders });
    }

    const currentTime = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }); // HH:mm:ss
    const formatterDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    let currentDay = formatterDay.format(new Date());
    if (currentDay === 'Minggu') currentDay = 'Ahad';

    let allSchedules: any[] = [];

    if (userRoleLower === 'guru') {
      const queryMadin = `
        SELECT j.jadwal_id as id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, 
               m.nama_kelas, 'madin' as tipe
        FROM jadwal_madin j
        JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
        WHERE j.hari = ? AND j.guru_id = ?
      `;
      
      const queryQuran = `
        SELECT j.id as id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, 
               q.nama_kelas, 'quran' as tipe
        FROM jadwal_quran j
        JOIN kelas_quran q ON j.kelas_quran_id = q.id
        WHERE j.hari = ? AND j.guru_id = ?
      `;

      // Guru yang juga merangkap pembina kamar — ambil juga dari jadwal_kegiatan
      const queryKegiatanGuru = `
        SELECT jk.kegiatan_id as id, jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran,
               k.nama_kamar as nama_kelas, 'kegiatan' as tipe
        FROM jadwal_kegiatan jk
        JOIN kamar k ON jk.kamar_id = k.kamar_id
        WHERE jk.hari = ? AND jk.guru_id = ?
      `;

      const [madinRows] = await pool.execute<RowDataPacket[]>(queryMadin, [currentDay, effGuruId]);
      const [quranRows] = await pool.execute<RowDataPacket[]>(queryQuran, [currentDay, effGuruId]);
      const [kegiatanGuruRows] = await pool.execute<RowDataPacket[]>(queryKegiatanGuru, [currentDay, effGuruId]);
      allSchedules = [...madinRows, ...quranRows, ...kegiatanGuruRows];
    } else if (userRoleLower === 'pengurus_asrama' || userRoleLower === 'pengasuh') {
      const queryKegiatan = `
        SELECT jk.kegiatan_id as id, jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran,
               k.nama_kamar as nama_kelas, 'kegiatan' as tipe
        FROM jadwal_kegiatan jk
        JOIN kamar k ON jk.kamar_id = k.kamar_id
        WHERE jk.hari = ? AND (jk.kamar_id = ? OR k.nama_asrama = ?)
      `;
      const [kegiatanRows] = await pool.execute<RowDataPacket[]>(queryKegiatan, [currentDay, effKamarId, payload.namaAsrama || '']);
      allSchedules = [...kegiatanRows];
    }

    const parseTime = (timeStr: string) => {
      const [h, m, s] = timeStr.split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };

    const currentSecs = parseTime(currentTime);

    let activeSchedule = null;

    // Find the first active schedule (30 mins before to 3 hours after)
    for (const sched of allSchedules) {
      const mulaiSecs = parseTime(sched.jam_mulai);
      const selesaiSecs = parseTime(sched.jam_selesai);
      
      const windowStart = mulaiSecs - 30 * 60;
      const windowEnd = selesaiSecs + 3 * 3600;

      if (currentSecs >= windowStart && currentSecs <= windowEnd) {
        let sudahAbsen = false;
        try {
          const todayDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
          if (sched.tipe === 'madin') {
            const [rows] = await pool.execute<RowDataPacket[]>(
              'SELECT 1 FROM absensi WHERE jadwal_madin_id = ? AND tanggal = ? LIMIT 1',
              [sched.id, todayDate]
            );
            sudahAbsen = rows.length > 0;
          } else if (sched.tipe === 'quran') {
            const [rows] = await pool.execute<RowDataPacket[]>(
              'SELECT 1 FROM absensi_quran WHERE jadwal_quran_id = ? AND tanggal = ? LIMIT 1',
              [sched.id, todayDate]
            );
            sudahAbsen = rows.length > 0;
          } else if (sched.tipe === 'kegiatan') {
            const [rows] = await pool.execute<RowDataPacket[]>(
              'SELECT 1 FROM absensi_kegiatan WHERE kegiatan_id = ? AND tanggal = ? LIMIT 1',
              [sched.id, todayDate]
            );
            sudahAbsen = rows.length > 0;
          }
        } catch (e) {
          // ignore
        }

        // Generate quick_url untuk guru
        let quickUrl: string | null = null;
        try {
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ppmawar.or.id';
          let waktuTenggang = 3;
          try {
            const [settingRows] = await pool.execute<RowDataPacket[]>(
              'SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = "waktu_tenggang_absensi" LIMIT 1'
            );
            if (settingRows.length > 0 && settingRows[0].nilai) {
              const parsed = parseInt(settingRows[0].nilai);
              if (!isNaN(parsed) && parsed > 0) waktuTenggang = parsed;
            }
          } catch (_) {}

          const todayDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
          const quickPayload: any = {
            type: 'quick_absen',
            guru_id: effGuruId || null,
            user_id: payload.userId || null,
            jadwal_id: Number(sched.id),
            tipe: sched.tipe,
            date: todayDate,
            role: userRoleLower,
            waktu_tenggang: waktuTenggang,
            createdAt: Date.now()
          };

          // Ambil nama guru
          try {
            if (effGuruId) {
              const [guruRows] = await pool.execute<RowDataPacket[]>(
                'SELECT nama FROM guru WHERE guru_id = ? LIMIT 1', [effGuruId]
              );
              if (guruRows.length > 0) quickPayload.guru_nama = guruRows[0].nama;
            }
          } catch (_) {}

          const quickToken = await createShortToken(quickPayload, `${waktuTenggang}h`, 'quick_absen');
          quickUrl = `${APP_URL}/absen/quick?token=${quickToken}`;
        } catch (_) {
          quickUrl = null;
        }

        const candidateSchedule = {
          id: sched.id,
          jadwal_id: sched.id,
          title: sched.tipe === 'kegiatan'
            ? `Kegiatan Kamar ${sched.nama_kelas}: ${sched.mata_pelajaran}`
            : `Mengajar ${sched.tipe === 'madin' ? 'Madin' : "Al-Qur'an"} ${sched.nama_kelas}`,
          nama_kelas: sched.nama_kelas,
          nama_kegiatan: sched.mata_pelajaran,
          mata_pelajaran: sched.mata_pelajaran,
          jam_mulai: sched.jam_mulai ? sched.jam_mulai.substring(0, 5) : '',
          jam_selesai: sched.jam_selesai ? sched.jam_selesai.substring(0, 5) : '',
          time: `${sched.jam_mulai ? sched.jam_mulai.substring(0, 5) : ''} - ${sched.jam_selesai ? sched.jam_selesai.substring(0, 5) : ''}`,
          status: currentSecs < mulaiSecs ? 'Persiapan Absen' : (currentSecs > selesaiSecs ? 'Batas Akhir Absen' : 'Sedang Berlangsung'),
          type: sched.tipe,
          tipe: sched.tipe,
          sudah_absen: sudahAbsen,
          quick_url: quickUrl,
        };

        if (!sudahAbsen) {
          activeSchedule = candidateSchedule;
          break; // Utamakan jadwal aktif yang BELUM diabsen
        } else if (!activeSchedule) {
          activeSchedule = candidateSchedule; // Simpan sebagai cadangan jika semua sudah diabsen
        }
      }
    }

    return NextResponse.json({
      success: true,
      activeSchedule: activeSchedule
    }, { headers: noCacheHeaders });
  } catch (error) {
    console.error('Error fetching active schedule:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: noCacheHeaders });
  }
}
