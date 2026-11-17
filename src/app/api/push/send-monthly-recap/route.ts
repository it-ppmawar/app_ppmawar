import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { createShortToken } from '@/lib/auth/shortToken';

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
    const bulanNum = bulanLalu.getMonth() + 1; // 1-12
    const tahunNum = bulanLalu.getFullYear();
    const bulanNama = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(bulanLalu);

    let sentCount = 0;
    const errors: string[] = [];

    // Ambil penugasan Kepala Madin dari database pengaturan
    let kepalaMadinPutraId = '';
    let kepalaMadinPutriId = '';
    let kepalaMadinAllId = '';
    try {
      const [settingRows] = await pool.query<RowDataPacket[]>(
        `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis
         WHERE nama_pengaturan IN ('kepala_madin_putra_id', 'kepala_madin_putri_id', 'kepala_madin_all_id')`
      );
      for (const r of settingRows) {
        if (r.nama_pengaturan === 'kepala_madin_putra_id') kepalaMadinPutraId = String(r.nilai || '').trim();
        if (r.nama_pengaturan === 'kepala_madin_putri_id') kepalaMadinPutriId = String(r.nilai || '').trim();
        if (r.nama_pengaturan === 'kepala_madin_all_id') kepalaMadinAllId = String(r.nilai || '').trim();
      }
    } catch (_) {}

    // =========================================================================
    // 1. GURU & KEPALA MADIN (GURU)
    // - Jika guru menjabat Kepala Madin -> diarahkan ke /rekap/kepala-madin?token=...
    // - Jika guru pengajar biasa -> diarahkan ke /rekap/guru?token=...
    // =========================================================================
    const [guruSubs] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key,
             COALESCE(u.guru_id, g.guru_id) as guru_id,
             g.nama as guru_nama, u.id as user_id
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      JOIN guru g ON (u.guru_id = g.guru_id OR g.user_id = u.id)
      WHERE u.role = 'guru'
    `);

    for (const sub of guruSubs) {
      const gidStr = String(sub.guru_id);
      const isKepalaPutra = kepalaMadinPutraId && gidStr === kepalaMadinPutraId;
      const isKepalaPutri = kepalaMadinPutriId && gidStr === kepalaMadinPutriId;
      const isKepalaAll = kepalaMadinAllId && gidStr === kepalaMadinAllId;
      const isKepalaMadin = isKepalaPutra || isKepalaPutri || isKepalaAll;

      let rekapUrl = `${APP_URL}/dashboard/absensi?tab=rekap&bulan=${bulanNum}&tahun=${tahunNum}`;
      let notifTitle = `📊 Rekap Absen Mengajar Madin – ${bulanNama} ${tahunNum}`;
      let notifBody = `Rekap kehadiran santri Madin bulan ${bulanNama} ${tahunNum} sudah tersedia. Ketuk untuk melihat detail kelas yang Anda ampu.`;

      if (isKepalaMadin) {
        const targetWilayah = isKepalaPutra ? 'putra' : isKepalaPutri ? 'putri' : 'all';
        const targetLabel = targetWilayah === 'putra' ? 'Madin Putra' : targetWilayah === 'putri' ? 'Madin Putri' : 'Madin';
        notifTitle = `📊 Evaluasi Dewan Guru ${targetLabel} – ${bulanNama} ${tahunNum}`;
        notifBody = `Laporan evaluasi kehadiran Dewan Guru ${targetLabel} periode ${bulanNama} ${tahunNum} siap ditinjau.`;

        const reportToken = await createShortToken({
          type: 'rekap_kepala_madin',
          bulan: bulanNum,
          tahun: tahunNum,
          target_wilayah: targetWilayah,
        }, '30d', 'rekap_kepala_madin');
        rekapUrl = `${APP_URL}/rekap/kepala-madin?token=${reportToken}`;
      } else {
        const rekapRefKey = `rekap_guru_${sub.guru_id}_${bulanNum}_${tahunNum}`;
        const rekapToken = await createShortToken({
          type: 'rekap_guru',
          guru_id: Number(sub.guru_id),
          bulan: bulanNum,
          tahun: tahunNum,
          categories: ['madin'], // Khusus Madin yang aktif saat ini
        }, '30d', 'rekap_guru', rekapRefKey);
        rekapUrl = `${APP_URL}/rekap/guru?token=${rekapToken}`;
      }

      const tag = `rekap_bulanan_${tahunNum}_${bulanNum}_guru_${sub.guru_id}`;
      const pushPayload = JSON.stringify({
        title: notifTitle,
        body: notifBody,
        vibrate: [200, 100, 200],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [{ action: 'open_rekap', title: '📋 Lihat Rekap Madin' }],
        data: { url: rekapUrl, rekapUrl, type: 'rekap_bulanan', tag },
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          pushPayload
        );
        sentCount++;
      } catch (e: any) {
        errors.push(`guru=${sub.guru_id}: ${e.message}`);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
        }
      }
    }

    // =========================================================================
    // 2. WALI MURID / SANTRI
    // - Diarahkan langsung ke /rekapitulasi/preview?t=token (tampilan sama persis pesan WA)
    // =========================================================================
    const [waliSubs] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key, u.id as user_id,
             u.murid_id, m.nama as santri_nama
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      JOIN murid m ON u.murid_id = m.murid_id
      WHERE u.role IN ('wali_murid', 'wali_alumni')
    `);

    for (const sub of waliSubs) {
      const previewToken = await createShortToken({
        muridId: Number(sub.murid_id),
        tipe: 'madin', // Khusus Madin yang aktif saat ini
        bulan: String(bulanNum),
        tahun: String(tahunNum),
        role: 'wali_murid',
        purpose: 'rekap_preview'
      }, '30d', 'rekap_preview');

      const rekapUrl = `${APP_URL}/rekapitulasi/preview?t=${previewToken}`;
      const tag = `rekap_bulanan_${tahunNum}_${bulanNum}_wali_${sub.user_id}`;
      const pushPayload = JSON.stringify({
        title: `📊 Rekap Absen Madin ${bulanNama} ${tahunNum}`,
        body: `Rekap kehadiran Madin Ananda ${sub.santri_nama} bulan ${bulanNama} ${tahunNum} sudah tersedia. Ketuk untuk melihat raport presensi.`,
        vibrate: [200, 100, 200],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [{ action: 'open_rekap', title: '📋 Lihat Rekap Madin' }],
        data: { url: rekapUrl, rekapUrl, type: 'rekap_bulanan', tag },
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          pushPayload
        );
        sentCount++;
      } catch (e: any) {
        errors.push(`wali user_id=${sub.user_id}: ${e.message}`);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
        }
      }
    }

    // =========================================================================
    // 3. ADMIN & STAFF (KEPALA MADIN / PENGAWAS)
    // - Diarahkan langsung ke /rekap/kepala-madin?token=token (evaluasi dewan guru resmi)
    // =========================================================================
    const [adminSubs] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth_key, u.id as user_id, u.role, u.username, u.nama, u.asrama
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      WHERE u.role IN ('admin', 'staff')
    `);

    for (const sub of adminSubs) {
      let targetWilayah: 'putra' | 'putri' | 'all' = 'all';
      if (sub.role === 'staff' && sub.asrama) {
        const asr = String(sub.asrama).toLowerCase();
        if (asr.includes('putra') || asr.startsWith('a-') || asr.startsWith('a ') || asr === 'asrama a') {
          targetWilayah = 'putra';
        } else if (asr.includes('putri') || ['b', 'c', 'd', 'e', 'f'].some(x => asr.includes(x))) {
          targetWilayah = 'putri';
        }
      }

      const targetLabel = targetWilayah === 'putra' ? 'Madin Putra' : targetWilayah === 'putri' ? 'Madin Putri' : 'Madin';

      const reportToken = await createShortToken({
        type: 'rekap_kepala_madin',
        bulan: bulanNum,
        tahun: tahunNum,
        target_wilayah: targetWilayah,
      }, '30d', 'rekap_kepala_madin');

      const rekapUrl = `${APP_URL}/rekap/kepala-madin?token=${reportToken}`;
      const tag = `rekap_bulanan_${tahunNum}_${bulanNum}_admin_${sub.user_id}`;
      const pushPayload = JSON.stringify({
        title: `📊 Evaluasi Dewan Guru ${targetLabel} – ${bulanNama} ${tahunNum}`,
        body: `Laporan rekapitulasi evaluasi Dewan Guru ${targetLabel} bulan ${bulanNama} ${tahunNum} siap ditinjau.`,
        vibrate: [200, 100, 200],
        tag,
        renotify: false,
        requireInteraction: false,
        actions: [{ action: 'open_rekap', title: '📋 Lihat Rekap Madin' }],
        data: { url: rekapUrl, rekapUrl, type: 'rekap_bulanan', tag },
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          pushPayload
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
      bulan: `${bulanNama} ${tahunNum}`,
      errors: errors.length > 0 ? errors : undefined,
      message: `✅ ${sentCount} push notifikasi rekap bulanan terkirim sesuai role masing-masing.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
