import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

// Endpoint ini dipanggil oleh cPanel Cron Job setiap 15 menit:
// curl "https://app.ppmawar.or.id/api/push/send-reminders?secret=GANTI_DENGAN_SECRET_ANDA"

const CRON_SECRET = process.env.CRON_SECRET || 'ppmawar-cron-2026';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@ppmawar.or.id';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Proteksi agar hanya cron job yang bisa memanggil
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys belum dikonfigurasi di .env' }, { status: 500 });
    }

    // Waktu sekarang di WIB
    const nowWIB = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const formatterDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    let hariIni = formatterDay.format(new Date());
    if (hariIni === 'Minggu') hariIni = 'Ahad';

    const hh = nowWIB.getHours();
    const mm = nowWIB.getMinutes();
    const currentSecs = hh * 3600 + mm * 60;

    // Window: cari jadwal yang mulai 25-35 menit dari sekarang
    const windowStart = currentSecs + 25 * 60;
    const windowEnd = currentSecs + 35 * 60;

    const toSecs = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 3600 + m * 60;
    };

    // Ambil semua jadwal hari ini dari 3 tipe
    const [madinRows] = await pool.query<RowDataPacket[]>(`
      SELECT j.jadwal_id as id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran,
             m.nama_kelas as kelas_nama, 'madin' as tipe,
             g.guru_id, g.nama as guru_nama
      FROM jadwal_madin j
      JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
      JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ?
    `, [hariIni]);

    const [quranRows] = await pool.query<RowDataPacket[]>(`
      SELECT j.id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran,
             q.nama_kelas as kelas_nama, 'quran' as tipe,
             g.guru_id, g.nama as guru_nama
      FROM jadwal_quran j
      JOIN kelas_quran q ON j.kelas_quran_id = q.id
      JOIN guru g ON j.guru_id = g.guru_id
      WHERE j.hari = ?
    `, [hariIni]);

    const [kegiatanRows] = await pool.query<RowDataPacket[]>(`
      SELECT jk.kegiatan_id as id, jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran,
             k.nama_kamar as kelas_nama, 'kegiatan' as tipe,
             g.guru_id, g.nama as guru_nama
      FROM jadwal_kegiatan jk
      JOIN kamar k ON jk.kamar_id = k.kamar_id
      JOIN guru g ON jk.guru_id = g.guru_id
      WHERE jk.hari = ?
    `, [hariIni]);

    const allJadwal = [...madinRows, ...quranRows, ...kegiatanRows];

    // Filter yang masuk dalam window 25-35 menit
    const upcoming = allJadwal.filter(j => {
      const s = toSecs(j.jam_mulai);
      return s >= windowStart && s <= windowEnd;
    });

    if (upcoming.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'Tidak ada jadwal dalam 30 menit ke depan.' });
    }

    // Import web-push
    const webpush = require('web-push');
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let sentCount = 0;
    const errors: string[] = [];

    for (const jadwal of upcoming) {
      // Ambil subscription guru terkait
      const [subscriptions] = await pool.query<RowDataPacket[]>(
        `SELECT endpoint, p256dh, auth_key FROM push_subscriptions
         WHERE user_id = (SELECT user_id FROM users WHERE guru_id = ? LIMIT 1)`,
        [jadwal.guru_id]
      );

      const jamMulai = jadwal.jam_mulai.substring(0, 5);
      const jamSelesai = jadwal.jam_selesai.substring(0, 5);
      const payload = JSON.stringify({
        title: `⏰ Pengingat Mengajar — ${jadwal.kelas_nama}`,
        body: `${jadwal.mata_pelajaran} | ${jamMulai} - ${jamSelesai} WIB | Mulai ~30 menit lagi`,
        url: '/dashboard',
        vibrate: [300, 100, 300, 100, 300],
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
            payload
          );
          sentCount++;
        } catch (e: any) {
          errors.push(`guru_id=${jadwal.guru_id}: ${e.message}`);
          // Jika subscription expired/invalid, hapus dari DB
          if (e.statusCode === 410 || e.statusCode === 404) {
            await pool.execute(
              'DELETE FROM push_subscriptions WHERE endpoint = ?',
              [sub.endpoint]
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      upcoming: upcoming.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `✅ ${sentCount} push notifikasi terkirim untuk ${upcoming.length} jadwal mendatang.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
