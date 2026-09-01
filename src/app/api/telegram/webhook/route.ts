import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendTelegramMessage, getTelegramConfig } from '@/lib/services/telegramBot';

export const dynamic = 'force-dynamic';

/**
 * Webhook Telegram Bot — menerima update dari server Telegram.
 * Mendukung:
 * - /start guru_<id>          → Pairing akun Telegram ke data Guru
 * - /start kepala_madin_putra → Pairing sebagai Kepala Madin Putra
 * - /start kepala_madin_putri → Pairing sebagai Kepala Madin Putri
 * - /start santri_<id>        → Pairing wali santri ke data Murid
 * - /status                   → Cek status pairing akun
 * - /bantuan / /help          → Petunjuk penggunaan bot
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.message) {
      return NextResponse.json({ ok: true }); // Telegram tetap diberi response 200
    }

    const config = await getTelegramConfig();
    const msg = body.message;
    const chatId = String(msg.chat?.id || '');
    const fromUser = msg.from;
    const text = (msg.text || '').trim();
    const telegramUsername = fromUser?.username || '';
    const telegramName = [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(' ') || 'Pengguna';

    if (!chatId) return NextResponse.json({ ok: true });

    // ── Handler /start <payload> ──────────────────────────────────────────
    if (text.startsWith('/start')) {
      const payload = text.replace('/start', '').trim();

      // /start tanpa payload → sambutan umum
      if (!payload) {
        await sendTelegramMessage({
          chat_id: chatId,
          botToken: config.botToken,
          text: `🕌 <b>Assalamu'alaikum Warohmatullah!</b>\n\n` +
            `Selamat datang di <b>PPMA Notifikasi Bot</b> — layanan notifikasi resmi\n` +
            `<b>Pondok Pesantren Matholi'ul Anwar (PPMA)</b>.\n\n` +
            `Untuk menghubungkan akun Telegram Anda, silakan:\n` +
            `• Buka aplikasi PPMAWAR di browser\n` +
            `• Masuk ke menu <b>Profil</b> atau <b>Notifikasi</b>\n` +
            `• Klik tombol <b>Hubungkan ke Telegram 📲</b>\n\n` +
            `Bot ini akan mengirimkan:\n` +
            `🔔 Pengingat jadwal mengajar (untuk Guru)\n` +
            `📊 Rekap kehadiran bulanan (untuk Kepala Madin)\n` +
            `📋 Laporan kehadiran & tagihan (untuk Wali Santri)\n\n` +
            `Ketik /bantuan untuk melihat daftar perintah.`,
        });
        return NextResponse.json({ ok: true });
      }

      // /start guru_<id>
      if (payload.startsWith('guru_')) {
        const guruId = parseInt(payload.replace('guru_', ''), 10);
        if (isNaN(guruId)) {
          await sendTelegramMessage({ chat_id: chatId, botToken: config.botToken, text: '❌ Link pairing tidak valid. Silakan ulangi dari aplikasi PPMAWAR.' });
          return NextResponse.json({ ok: true });
        }

        const [guruRows] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id, nama, telegram_chat_id FROM guru WHERE guru_id = ? LIMIT 1',
          [guruId]
        );

        if (!guruRows.length) {
          await sendTelegramMessage({ chat_id: chatId, botToken: config.botToken, text: '❌ Data guru tidak ditemukan. Pastikan link pairing yang digunakan benar.' });
          return NextResponse.json({ ok: true });
        }

        const guru = guruRows[0];

        // Cek jika sudah terhubung dengan guru lain (konflik)
        const [conflictRows] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id, nama FROM guru WHERE telegram_chat_id = ? AND guru_id != ? LIMIT 1',
          [chatId, guruId]
        );
        if (conflictRows.length) {
          await sendTelegramMessage({
            chat_id: chatId, botToken: config.botToken,
            text: `⚠️ Akun Telegram ini sudah terhubung dengan <b>${conflictRows[0].nama}</b>.\n` +
              `Jika ingin mengganti, hubungi admin PPMA untuk melepas pairing lama.`
          });
          return NextResponse.json({ ok: true });
        }

        await pool.execute(
          'UPDATE guru SET telegram_chat_id = ?, telegram_username = ? WHERE guru_id = ?',
          [chatId, telegramUsername, guruId]
        );

        // Update juga di tabel users jika ada
        await pool.execute(
          'UPDATE users SET telegram_chat_id = ?, telegram_username = ? WHERE guru_id = ? LIMIT 1',
          [chatId, telegramUsername, guruId]
        ).catch(() => {});

        await sendTelegramMessage({
          chat_id: chatId,
          botToken: config.botToken,
          text: `✅ <b>Alhamdulillah, berhasil terhubung!</b>\n\n` +
            `Akun Telegram Anda telah berhasil dihubungkan dengan data:\n` +
            `👤 <b>${guru.nama}</b>\n` +
            `🤖 Username Bot: @${config.botUsername}\n\n` +
            `Mulai sekarang Anda akan menerima:\n` +
            `🔔 Pengingat jadwal mengajar sebelum jam mulai\n` +
            `✅ Tombol Absen Cepat & Ajukan Izin langsung dari Telegram\n\n` +
            `Ketik /status untuk melihat status akun Anda.\n` +
            `Jazakumullah khairan 🙏`,
        });
        return NextResponse.json({ ok: true });
      }

      // /start kepala_madin_putra
      if (payload === 'kepala_madin_putra' || payload === 'kepala_madin_putri' || payload === 'kepala_madin') {
        const settingKey = payload === 'kepala_madin_putra'
          ? 'telegram_kepala_madin_putra_chat_id'
          : payload === 'kepala_madin_putri'
          ? 'telegram_kepala_madin_putri_chat_id'
          : 'telegram_kepala_madin_chat_id';

        const label = payload === 'kepala_madin_putra' ? 'Kepala Madin Putra'
          : payload === 'kepala_madin_putri' ? 'Kepala Madin Putri'
          : 'Kepala Madrasah Diniyah';

        await pool.execute(
          `INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE nilai = ?`,
          [settingKey, chatId, chatId]
        );

        await sendTelegramMessage({
          chat_id: chatId,
          botToken: config.botToken,
          text: `✅ <b>Pairing sebagai ${label} berhasil!</b>\n\n` +
            `Akun Telegram ini (@${telegramUsername || telegramName}) telah didaftarkan sebagai penerima:\n` +
            `📊 Laporan Rekapitulasi Kehadiran Dewan Guru Madin Bulanan\n\n` +
            `Laporan akan dikirimkan otomatis setiap awal bulan atau kapan pun admin mengirimkan rekap dari dashboard.\n\n` +
            `Jazakumullah khairan 🙏`,
        });
        return NextResponse.json({ ok: true });
      }

      // /start santri_<id>
      if (payload.startsWith('santri_')) {
        const muridId = parseInt(payload.replace('santri_', ''), 10);
        if (isNaN(muridId)) {
          await sendTelegramMessage({ chat_id: chatId, botToken: config.botToken, text: '❌ Link pairing tidak valid.' });
          return NextResponse.json({ ok: true });
        }

        const [muridRows] = await pool.execute<RowDataPacket[]>(
          'SELECT murid_id, nama, nama_wali FROM murid WHERE murid_id = ? LIMIT 1',
          [muridId]
        );

        if (!muridRows.length) {
          await sendTelegramMessage({ chat_id: chatId, botToken: config.botToken, text: '❌ Data santri tidak ditemukan.' });
          return NextResponse.json({ ok: true });
        }

        const murid = muridRows[0];

        await pool.execute(
          'UPDATE murid SET telegram_chat_id = ?, telegram_username = ? WHERE murid_id = ?',
          [chatId, telegramUsername, muridId]
        );

        await sendTelegramMessage({
          chat_id: chatId,
          botToken: config.botToken,
          text: `✅ <b>Pairing Wali Santri berhasil!</b>\n\n` +
            `Akun Telegram ini telah terhubung dengan data santri:\n` +
            `👦 <b>${murid.nama}</b>\n` +
            `👨‍👩‍👧 Wali: ${murid.nama_wali || '-'}\n\n` +
            `Mulai sekarang Anda akan menerima notifikasi:\n` +
            `📋 Laporan kehadiran harian ananda\n` +
            `💳 Informasi tagihan administrasi pesantren\n\n` +
            `Jazakumullah khairan 🙏`,
        });
        return NextResponse.json({ ok: true });
      }

      // Payload tidak dikenali
      await sendTelegramMessage({
        chat_id: chatId, botToken: config.botToken,
        text: `❓ Link pairing tidak dikenali. Silakan ulangi dari aplikasi PPMAWAR.\n\nKetik /bantuan untuk bantuan lebih lanjut.`
      });
      return NextResponse.json({ ok: true });
    }

    // ── Handler /status ────────────────────────────────────────────────────
    if (text === '/status') {
      // Cek apakah chat_id terdaftar sebagai guru
      const [guruRows] = await pool.execute<RowDataPacket[]>(
        'SELECT guru_id, nama FROM guru WHERE telegram_chat_id = ? LIMIT 1',
        [chatId]
      );

      // Cek apakah terdaftar sebagai wali santri
      const [muridRows] = await pool.execute<RowDataPacket[]>(
        'SELECT murid_id, nama FROM murid WHERE telegram_chat_id = ? LIMIT 1',
        [chatId]
      );

      // Cek kepala madin
      const [kepalaMadinRows] = await pool.execute<RowDataPacket[]>(
        `SELECT nama_pengaturan FROM pengaturan_absensi_otomatis 
         WHERE nilai = ? AND nama_pengaturan IN (
           'telegram_kepala_madin_putra_chat_id', 
           'telegram_kepala_madin_putri_chat_id', 
           'telegram_kepala_madin_chat_id'
         ) LIMIT 3`,
        [chatId]
      );

      let statusLines = [`🤖 <b>Status Akun Telegram PPMAWAR</b>\n`];
      statusLines.push(`📱 Chat ID: <code>${chatId}</code>`);
      if (telegramUsername) statusLines.push(`👤 Username: @${telegramUsername}`);

      if (guruRows.length) {
        statusLines.push(`\n✅ <b>Terhubung sebagai:</b> Guru/Ustadz`);
        statusLines.push(`👤 Nama: <b>${guruRows[0].nama}</b>`);
        statusLines.push(`🔔 Notifikasi pengingat jadwal: <b>Aktif</b>`);
      }
      if (muridRows.length) {
        statusLines.push(`\n✅ <b>Terhubung sebagai:</b> Wali Santri`);
        statusLines.push(`👦 Santri: <b>${muridRows[0].nama}</b>`);
        statusLines.push(`📋 Notifikasi kehadiran: <b>Aktif</b>`);
      }
      if (kepalaMadinRows.length) {
        const labels = kepalaMadinRows.map(r =>
          r.nama_pengaturan === 'telegram_kepala_madin_putra_chat_id' ? 'Kepala Madin Putra'
            : r.nama_pengaturan === 'telegram_kepala_madin_putri_chat_id' ? 'Kepala Madin Putri'
            : 'Kepala Madrasah Diniyah'
        );
        statusLines.push(`\n✅ <b>Terdaftar sebagai:</b> ${labels.join(' & ')}`);
        statusLines.push(`📊 Notifikasi rekap bulanan: <b>Aktif</b>`);
      }

      if (!guruRows.length && !muridRows.length && !kepalaMadinRows.length) {
        statusLines.push(`\n⚪ Akun ini belum terhubung dengan data apapun di PPMAWAR.`);
        statusLines.push(`\nSilakan buka aplikasi PPMAWAR dan klik tombol <b>Hubungkan ke Telegram 📲</b>.`);
      }

      await sendTelegramMessage({ chat_id: chatId, botToken: config.botToken, text: statusLines.join('\n') });
      return NextResponse.json({ ok: true });
    }

    // ── Handler /bantuan / /help ───────────────────────────────────────────
    if (text === '/bantuan' || text === '/help') {
      await sendTelegramMessage({
        chat_id: chatId,
        botToken: config.botToken,
        text: `📖 <b>Bantuan PPMA Notifikasi Bot</b>\n\n` +
          `<b>Perintah yang tersedia:</b>\n` +
          `/start — Mulai & sambutan\n` +
          `/status — Cek status pairing akun Anda\n` +
          `/bantuan — Tampilkan pesan bantuan ini\n\n` +
          `<b>Cara menghubungkan akun:</b>\n` +
          `1. Buka aplikasi PPMAWAR di browser\n` +
          `2. Login dengan akun Anda\n` +
          `3. Buka menu <b>Notifikasi</b> atau <b>Profil</b>\n` +
          `4. Klik tombol <b>Hubungkan ke Telegram 📲</b>\n\n` +
          `<b>Butuh bantuan lebih?</b>\n` +
          `Hubungi pengurus PPMA atau admin sistem.\n\n` +
          `_Pengurus PP. Matholi'ul Anwar_`,
      });
      return NextResponse.json({ ok: true });
    }

    // Pesan lain yang tidak dikenali — jangan balas otomatis agar tidak spam
    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error('[Telegram Webhook] Error:', err);
    return NextResponse.json({ ok: true }); // Selalu return 200 ke Telegram
  }
}
