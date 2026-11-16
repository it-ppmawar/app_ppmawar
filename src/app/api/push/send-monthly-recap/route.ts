import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

// Endpoint ini dipanggil cron job setiap tanggal 1 pukul 06:00 WIB:
// curl "https://app.ppmawar.or.id/api/push/send-monthly-recap?secret=ppmawar-cron-2026"
// Cron expression: 0 6 1 * *

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

    // Hitung bulan lalu
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const bulanLalu = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const bulanStr = bulanLalu.getMonth() + 1; // 1-12
    const tahunStr = bulanLalu.getFullYear();
    const bulanNama = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(bulanLalu);

    // Rekapitulasi URL dasar
    const rekapBaseUrl = `${APP_URL}/dashboard/absensi?tab=rekap&bulan=${bulanStr}&tahun=${tahunStr}`;

    let sentCount = 0;
    const errors: string[] = [];

    // === Kirim ke GURU: rekap semua santri di kelas mereka ===
    const [guruSubs] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key, g.guru_id, g.nama as guru_nama,
             u.user_id
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.user_id
      JOIN guru g ON u.guru_id = g.guru_id
      WHERE u.role = 'guru'
    `);

    for (const sub of guruSubs) {
      const rekapUrl = `${rekapBaseUrl}&guru_id=${sub.guru_id}`;
      const tag = `rekap_bulanan_${tahunStr}_${bulanStr}_guru_${sub.guru_id}`;
      const payload = JSON.stringify({
        title: `📊 Rekap Absen ${bulanNama} ${tahunStr}`,
        body: `Rekap kehadiran santri bulan ${bulanNama} ${tahunStr} sudah tersedia. Ketuk untuk melihat detail.`,
        vibrate: [200, 100, 200],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [
          { action: 'open_rekap', title: '📋 Lihat Rekap Absen' }
        ],
        data: {
          url: rekapUrl,
          rekapUrl,
          type: 'rekap_bulanan',
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
        errors.push(`guru=${sub.guru_id}: ${e.message}`);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
        }
      }
    }

    // === Kirim ke WALI MURID: rekap santri mereka ===
    const [waliSubs] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key, u.user_id,
             wm.santri_id, s.nama as santri_nama
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.user_id
      JOIN wali_murid wm ON u.user_id = wm.user_id
      JOIN santri s ON wm.santri_id = s.santri_id
      WHERE u.role IN ('wali_murid', 'wali_alumni')
    `);

    for (const sub of waliSubs) {
      const rekapUrl = `${rekapBaseUrl}&santri_id=${sub.santri_id}`;
      const tag = `rekap_bulanan_${tahunStr}_${bulanStr}_wali_${sub.user_id}`;
      const payload = JSON.stringify({
        title: `📊 Rekap Absen ${bulanNama} ${tahunStr}`,
        body: `Rekap kehadiran ${sub.santri_nama} bulan ${bulanNama} ${tahunStr} sudah tersedia.`,
        vibrate: [200, 100, 200],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [
          { action: 'open_rekap', title: '📋 Lihat Rekap Absen' }
        ],
        data: {
          url: rekapUrl,
          rekapUrl,
          type: 'rekap_bulanan',
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

    // === Kirim ke ADMIN/STAFF (kepala madin): rekap semua guru ===
    const [adminSubs] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key, u.user_id, u.role
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.user_id
      WHERE u.role IN ('admin', 'staff')
    `);

    for (const sub of adminSubs) {
      const rekapUrl = `${APP_URL}/dashboard/notifikasi`;
      const tag = `rekap_bulanan_${tahunStr}_${bulanStr}_admin_${sub.user_id}`;
      const payload = JSON.stringify({
        title: `📊 Rekap Absen ${bulanNama} ${tahunStr}`,
        body: `Rekap absensi seluruh guru & santri bulan ${bulanNama} ${tahunStr} siap dilihat.`,
        vibrate: [200, 100, 200],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [
          { action: 'open_rekap', title: '📋 Lihat Rekap Absen' }
        ],
        data: {
          url: rekapUrl,
          rekapUrl,
          type: 'rekap_bulanan',
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
        errors.push(`admin user_id=${sub.user_id}: ${e.message}`);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      bulan: `${bulanNama} ${tahunStr}`,
      errors: errors.length > 0 ? errors : undefined,
      message: `✅ ${sentCount} push notifikasi rekap bulanan terkirim.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
