import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

// Endpoint dipanggil saat nilai baru dimasukkan di halaman Penilaian & Raport Digital
// Method: POST, body: { santri_id, mata_pelajaran, kelas_nama, guru_nama }
// Proteksi: hanya bisa dipanggil dengan internal secret

const CRON_SECRET = process.env.CRON_SECRET || 'ppmawar-cron-2026';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@ppmawar.or.id';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ppmawar.or.id';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys belum dikonfigurasi' }, { status: 500 });
    }

    const body = await request.json();
    const { santri_id, mata_pelajaran, kelas_nama, guru_nama } = body;

    if (!santri_id) {
      return NextResponse.json({ error: 'santri_id diperlukan' }, { status: 400 });
    }

    const webpush = require('web-push');
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const nilaiUrl = `${APP_URL}/dashboard/penilaian?tab=raport-santri&santri_id=${santri_id}`;
    const tanggalHari = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
    const tag = `nilai_masuk_${santri_id}_${tanggalHari}`;

    // Ambil wali murid yang terkait santri ini
    const [waliSubs] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key, u.user_id, s.nama as santri_nama
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.user_id
      JOIN wali_murid wm ON u.user_id = wm.user_id
      JOIN santri s ON wm.santri_id = s.santri_id
      WHERE wm.santri_id = ? AND u.role IN ('wali_murid', 'wali_alumni')
    `, [santri_id]);

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of waliSubs) {
      const mapel = mata_pelajaran ? ` (${mata_pelajaran})` : '';
      const kelas = kelas_nama ? ` - ${kelas_nama}` : '';
      const payload = JSON.stringify({
        title: `📝 Nilai Baru Masuk`,
        body: `Nilai ${sub.santri_nama}${mapel}${kelas} telah diinput. Ketuk untuk melihat raport.`,
        vibrate: [100, 50, 100],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [
          { action: 'open_nilai', title: '📄 Lihat Raport' }
        ],
        data: {
          url: nilaiUrl,
          nilaiUrl,
          type: 'nilai_masuk',
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
      message: `✅ ${sentCount} push notifikasi nilai terkirim ke wali santri.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
