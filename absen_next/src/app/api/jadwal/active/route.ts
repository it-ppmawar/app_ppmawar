import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

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
      const { getActivePendingReminders } = await import('@/lib/jadwal/activeReminders');
      const pendingReminders = await getActivePendingReminders();
      return NextResponse.json({
        success: true,
        activeSchedule: null,
        pendingRemindersCount: pendingReminders.length,
        data: pendingReminders
      }, { headers: noCacheHeaders });
    }

    if ((role === 'guru' && !guruId) || ((role === 'pengurus_asrama' || role === 'pengasuh') && !kamarId)) {
      return NextResponse.json({ success: true, activeSchedule: null }, { headers: noCacheHeaders });
    }

    const currentTime = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }); // HH:mm:ss
    const formatterDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    let currentDay = formatterDay.format(new Date());
    if (currentDay === 'Minggu') currentDay = 'Ahad';

    let allSchedules: any[] = [];

    if (role === 'guru') {
      const queryMadin = `
        SELECT j.jam_mulai, j.jam_selesai, j.mata_pelajaran, 
               m.nama_kelas, 'madin' as tipe
        FROM jadwal_madin j
        JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
        WHERE j.hari = ? AND j.guru_id = ?
      `;
      
      const queryQuran = `
        SELECT j.jam_mulai, j.jam_selesai, j.mata_pelajaran, 
               q.nama_kelas, 'quran' as tipe
        FROM jadwal_quran j
        JOIN kelas_quran q ON j.kelas_quran_id = q.id
        WHERE j.hari = ? AND j.guru_id = ?
      `;

      // Guru yang juga merangkap pembina kamar — ambil juga dari jadwal_kegiatan
      const queryKegiatanGuru = `
        SELECT jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran,
               k.nama_kamar as nama_kelas, 'kegiatan' as tipe
        FROM jadwal_kegiatan jk
        JOIN kamar k ON jk.kamar_id = k.kamar_id
        WHERE jk.hari = ? AND jk.guru_id = ?
      `;

      const [madinRows] = await pool.execute<RowDataPacket[]>(queryMadin, [currentDay, guruId]);
      const [quranRows] = await pool.execute<RowDataPacket[]>(queryQuran, [currentDay, guruId]);
      const [kegiatanGuruRows] = await pool.execute<RowDataPacket[]>(queryKegiatanGuru, [currentDay, guruId]);
      allSchedules = [...madinRows, ...quranRows, ...kegiatanGuruRows];
    } else if (role === 'pengurus_asrama' || role === 'pengasuh') {
      const queryKegiatan = `
        SELECT jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran,
               k.nama_kamar as nama_kelas, 'kegiatan' as tipe
        FROM jadwal_kegiatan jk
        JOIN kamar k ON jk.kamar_id = k.kamar_id
        WHERE jk.hari = ? AND jk.kamar_id = ?
      `;
      const [kegiatanRows] = await pool.execute<RowDataPacket[]>(queryKegiatan, [currentDay, kamarId]);
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
        activeSchedule = {
          title: sched.tipe === 'kegiatan'
            ? `Kegiatan Kamar ${sched.nama_kelas}: ${sched.mata_pelajaran}`
            : `Mengajar ${sched.tipe === 'madin' ? 'Madin' : "Al-Qur'an"} ${sched.nama_kelas}`,
          time: `${sched.jam_mulai.substring(0,5)} - ${sched.jam_selesai.substring(0,5)}`,
          status: currentSecs < mulaiSecs ? 'Persiapan Absen' : (currentSecs > selesaiSecs ? 'Batas Akhir Absen' : 'Sedang Berlangsung'),
          type: sched.tipe
        };
        break; // Show only the first active one
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
