import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

// Endpoint dipanggil cron job mingguan atau saat tagihan baru dibuat:
// curl "https://app.ppmawar.or.id/api/push/send-tagihan-notif?secret=ppmawar-cron-2026"
// Cron: 0 7 * * 1 (setiap Senin pukul 07:00 WIB)

const CRON_SECRET = process.env.CRON_SECRET || 'ppmawar-cron-2026';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@ppmawar.or.id';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ppmawar.or.id';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys belum dikonfigurasi' }, { status: 500 });
    }

    const webpush = require('web-push');
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const tanggalHari = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

    // Ambil wali murid yang punya tagihan belum lunas
    // Mencoba query dengan berbagai kemungkinan struktur tabel tagihan
    let waliWithTagihan: RowDataPacket[] = [];
    try {
      // Coba query dengan asumsi ada tabel tagihan + wali_murid
      const [rows] = await pool.query<RowDataPacket[]>(`
        SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key, u.user_id,
               s.nama as santri_nama,
               COUNT(t.id) as jumlah_tagihan
        FROM push_subscriptions ps
        JOIN users u ON ps.user_id = u.user_id
        JOIN wali_murid wm ON u.user_id = wm.user_id
        JOIN santri s ON wm.santri_id = s.santri_id
        JOIN tagihan t ON t.santri_id = wm.santri_id
        WHERE u.role IN ('wali_murid', 'wali_alumni')
          AND t.status IN ('belum_lunas', 'menunggak', 'pending')
        GROUP BY ps.endpoint, ps.p256dh, ps.auth_key, u.user_id, s.nama
        HAVING COUNT(t.id) > 0
      `);
      waliWithTagihan = rows;
    } catch (queryErr: any) {
      // Jika query gagal (tabel belum ada atau struktur berbeda), skip
      console.warn('Query tagihan notif gagal:', queryErr?.message);
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'Tidak ada tagihan belum lunas atau tabel tidak tersedia.',
      });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of waliWithTagihan) {
      const tagihanUrl = `${APP_URL}/dashboard/billing`;
      const tag = `tagihan_belum_lunas_${sub.user_id}_${tanggalHari}`;
      const jumlah = sub.jumlah_tagihan || 1;
      const payload = JSON.stringify({
        title: `💳 Tagihan Belum Lunas`,
        body: `${sub.santri_nama} memiliki ${jumlah} tagihan yang belum lunas. Ketuk untuk melihat detail.`,
        vibrate: [200, 100, 200],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [
          { action: 'open_tagihan', title: '💰 Lihat Tagihan' }
        ],
        data: {
          url: tagihanUrl,
          tagihanUrl,
          type: 'tagihan_belum_lunas',
          tag,
        },
      });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        sentCount++;
      } catch (e: any) {
        errors.push(`wali user_id=${sub.user_id}: ${e.message}`);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `✅ ${sentCount} push notifikasi tagihan terkirim ke wali santri.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
