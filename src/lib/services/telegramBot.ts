import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const DEFAULT_TELEGRAM_TOKEN = '8260588054:AAEB_71eA2XnRLHiYQV6jsZaiapsYcMd6yE';
export const DEFAULT_TELEGRAM_USERNAME = 'ppma_notif_bot';
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

export interface TelegramConfig {
  botToken: string;
  botUsername: string;
  notificationMode: 'telegram_only' | 'wa_only' | 'both';
  kepalaMainPutraChatId: string;
  kepalaMainPutriChatId: string;
  kepalaMainChatId: string;
}

/**
 * Ambil konfigurasi Telegram Bot dari database dengan fallback ke default
 */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis 
       WHERE nama_pengaturan IN (
         'telegram_bot_token', 'telegram_bot_username', 'telegram_notification_mode',
         'telegram_kepala_madin_putra_chat_id', 'telegram_kepala_madin_putri_chat_id',
         'telegram_kepala_madin_chat_id'
       )`
    );

    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.nama_pengaturan] = r.nilai; });

    return {
      botToken: map['telegram_bot_token']?.trim() || DEFAULT_TELEGRAM_TOKEN,
      botUsername: map['telegram_bot_username']?.trim() || DEFAULT_TELEGRAM_USERNAME,
      notificationMode: (map['telegram_notification_mode'] as any) || 'both',
      kepalaMainPutraChatId: map['telegram_kepala_madin_putra_chat_id'] || '',
      kepalaMainPutriChatId: map['telegram_kepala_madin_putri_chat_id'] || '',
      kepalaMainChatId: map['telegram_kepala_madin_chat_id'] || '',
    };
  } catch {
    return {
      botToken: DEFAULT_TELEGRAM_TOKEN,
      botUsername: DEFAULT_TELEGRAM_USERNAME,
      notificationMode: 'both',
      kepalaMainPutraChatId: '',
      kepalaMainPutriChatId: '',
      kepalaMainChatId: '',
    };
  }
}

/**
 * Kirim pesan teks ke Telegram chat_id tertentu (format HTML)
 */
export async function sendTelegramMessage(options: {
  chat_id: string | number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: object;
  botToken?: string;
}): Promise<{ success: boolean; message: string; data?: any }> {
  const token = options.botToken || DEFAULT_TELEGRAM_TOKEN;
  const url = `${TELEGRAM_API_BASE}${token}/sendMessage`;

  if (!options.chat_id || String(options.chat_id).trim() === '') {
    return { success: false, message: 'chat_id kosong atau tidak valid' };
  }

  const payload: any = {
    chat_id: options.chat_id,
    text: options.text,
    parse_mode: options.parse_mode || 'HTML',
  };

  if (options.reply_markup) {
    payload.reply_markup = JSON.stringify(options.reply_markup);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json?.ok) {
      return { success: true, message: 'Pesan Telegram berhasil dikirim', data: json.result };
    } else {
      const errDesc = json?.description || `HTTP ${res.status}`;
      return { success: false, message: `Gagal kirim Telegram: ${errDesc}`, data: json };
    }
  } catch (err: any) {
    return { success: false, message: 'Koneksi ke Telegram gagal: ' + err.message };
  }
}

/**
 * Kirim pengingat jadwal guru ke Telegram dengan tombol interaktif Absen Cepat & Izin
 */
export async function sendTeacherReminderTelegram(options: {
  chat_id: string;
  guru_nama: string;
  hari: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  kelas_nama: string;
  mata_pelajaran: string;
  tipe: string;
  quick_url: string;
  quick_izin_url?: string;
  botToken?: string;
}): Promise<{ success: boolean; message: string }> {
  const t = (options.tipe || '').toLowerCase();
  let kategoriLabel = 'Madin';
  let labelMapel = 'Mapel';

  if (t.includes('quran')) {
    kategoriLabel = "Al-Qur'an";
    labelMapel = 'Majlis';
  } else if (t.includes('kamar') || t.includes('kegiatan') || t.includes('asrama')) {
    kategoriLabel = 'Asrama';
    labelMapel = 'Kegiatan';
  }

  const jamLabel = `${(options.jam_mulai || '').substring(0, 5)} - ${(options.jam_selesai || '').substring(0, 5)}`;

  const text = `🔔 <b>Pengingat Jadwal Mengajar PPMA</b>\n\n` +
    `Assalamu'alaikum Warohmatullah, <b>${options.guru_nama}</b>.\n\n` +
    `Anda memiliki jadwal mengajar:\n` +
    `📅 <b>Hari/Tgl</b>: ${options.hari}, ${options.tanggal}\n` +
    `🏫 <b>Kategori</b>: ${kategoriLabel}\n` +
    `📚 <b>${labelMapel}</b>: ${options.mata_pelajaran || '-'}\n` +
    `🚪 <b>Tempat/Kelas</b>: ${options.kelas_nama || '-'}\n` +
    `⏰ <b>Jam</b>: ${jamLabel}\n\n` +
    `Mohon hadir tepat waktu dan isi absensi melalui tombol di bawah ini. Jazakumullah khairan. 🙏`;

  const buttons = [
    [
      { text: '✅ Klik Absen Cepat (Hadir)', url: options.quick_url },
    ],
    [
      { text: '📝 Ajukan Izin / Sakit', url: options.quick_izin_url || options.quick_url },
    ],
  ];

  return sendTelegramMessage({
    chat_id: options.chat_id,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
    botToken: options.botToken,
  });
}

/**
 * Kirim laporan rekapitulasi bulanan ke Telegram Kepala Madin
 */
export async function sendKepalaMadinReportTelegram(options: {
  chat_id: string;
  kepala_nama: string;
  bulan_tahun: string;
  total_guru: number;
  avg_kehadiran: number;
  total_sesi: number;
  total_hadir: number;
  total_izin_sakit: number;
  total_alpha: number;
  report_url: string;
  wilayah_label?: string;
  botToken?: string;
}): Promise<{ success: boolean; message: string }> {
  const pctEmoji = options.avg_kehadiran >= 90 ? '🟢' : options.avg_kehadiran >= 75 ? '🟡' : '🔴';

  const text = `📊 <b>Laporan Rekapitulasi Kehadiran Dewan Guru Madin</b>\n` +
    `${options.wilayah_label ? `<i>${options.wilayah_label}</i>\n` : ''}` +
    `Pondok Pesantren Matholi'ul Anwar\n\n` +
    `Yth. <b>${options.kepala_nama}</b>,\n\n` +
    `Berikut laporan kehadiran Dewan Guru untuk periode <b>${options.bulan_tahun}</b>:\n\n` +
    `${pctEmoji} <b>Ringkasan Presensi:</b>\n` +
    `• Total Dewan Guru: <b>${options.total_guru} Guru</b>\n` +
    `• Total Sesi Terlaksana: <b>${options.total_sesi} Sesi</b>\n` +
    `• Rata-rata Kehadiran: <b>${options.avg_kehadiran}%</b>\n` +
    `• Hadir: <b>${options.total_hadir} Sesi</b>\n` +
    `• Izin/Sakit: <b>${options.total_izin_sakit} Sesi</b>\n` +
    `• Tanpa Keterangan: <b>${options.total_alpha} Sesi</b>\n\n` +
    `Klik tombol di bawah untuk melihat detail evaluasi lengkap dan ekspor laporan resmi.`;

  const buttons = [
    [
      { text: '📊 Buka Detail Evaluasi Lengkap', url: options.report_url },
    ],
  ];

  return sendTelegramMessage({
    chat_id: options.chat_id,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
    botToken: options.botToken,
  });
}

/**
 * Kirim notifikasi kehadiran santri ke Telegram wali murid
 */
export async function sendWaliNotificationTelegram(options: {
  chat_id: string;
  nama_santri: string;
  kegiatan: string;
  kelas: string;
  status: string;
  catatan?: string;
  laporan_url?: string;
  botToken?: string;
}): Promise<{ success: boolean; message: string }> {
  const statusEmoji = options.status === 'Hadir' ? '✅' :
    options.status === 'Izin' ? '🔵' :
    options.status === 'Sakit' ? '🟡' : '🔴';

  const text = `🕌 <b>Laporan Kehadiran Santri PPMA</b>\n\n` +
    `Yth. Wali dari Ananda <b>${options.nama_santri}</b>,\n\n` +
    `• <b>Kegiatan</b>: ${options.kegiatan}\n` +
    `• <b>Kelas/Tempat</b>: ${options.kelas}\n` +
    `• <b>Status</b>: ${statusEmoji} <b>${options.status}</b>\n` +
    (options.catatan ? `• <b>Catatan</b>: ${options.catatan}\n` : '') +
    `\n_Atas perhatiannya kami ucapkan terima kasih._\n` +
    `_Pengurus PP. Matholi'ul Anwar_`;

  const buttons = options.laporan_url ? [
    [{ text: '📋 Lihat Laporan Lengkap', url: options.laporan_url }],
  ] : undefined;

  return sendTelegramMessage({
    chat_id: options.chat_id,
    text,
    parse_mode: 'HTML',
    reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
    botToken: options.botToken,
  });
}

/**
 * Set Webhook URL di Telegram agar bot menerima update secara realtime
 */
export async function setTelegramWebhook(webhookUrl: string, botToken?: string): Promise<{ success: boolean; message: string }> {
  const token = botToken || DEFAULT_TELEGRAM_TOKEN;
  const url = `${TELEGRAM_API_BASE}${token}/setWebhook`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const json = await res.json().catch(() => null);

    if (res.ok && json?.ok) {
      return { success: true, message: json.description || 'Webhook berhasil dipasang!' };
    } else {
      return { success: false, message: json?.description || `HTTP ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, message: 'Gagal memasang webhook: ' + err.message };
  }
}

/**
 * Cek info webhook yang sedang aktif
 */
export async function getTelegramWebhookInfo(botToken?: string): Promise<any> {
  const token = botToken || DEFAULT_TELEGRAM_TOKEN;
  const url = `${TELEGRAM_API_BASE}${token}/getWebhookInfo`;
  try {
    const res = await fetch(url);
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/**
 * Cek info bot (getMe)
 */
export async function getTelegramBotInfo(botToken?: string): Promise<any> {
  const token = botToken || DEFAULT_TELEGRAM_TOKEN;
  const url = `${TELEGRAM_API_BASE}${token}/getMe`;
  try {
    const res = await fetch(url);
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}
