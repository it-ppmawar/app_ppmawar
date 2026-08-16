import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export interface SendWaScheduleOptions {
  phone_number: string;
  message: string;
  scheduled_time: string; // Format: YYYY-MM-DDTHH:MM
  is_loop?: 0 | 1;
  loop_interval?: 'daily' | 'weekly' | 'monthly';
  apiKey?: string;
  endpoint?: string;
}

export interface WaSchedulerConfig {
  apiKey: string;
  endpoint: string;
  leadTimeMinutes: number;
  isLoop: 0 | 1;
}

export const DEFAULT_WA_SCHEDULER_KEY = 'wa-key-923332d62d67d2511393e0c6d8ff5e59';
export const DEFAULT_WA_SCHEDULER_ENDPOINT = 'https://wa.quizb.my.id/api/send.php';

/**
 * Format nomor telepon lokal Indonesia (08xxx / +628xxx) ke format internasional standar (628xxx)
 */
export function formatToWaPhone(phone: string | number | null | undefined): string {
  if (!phone) return '';
  let cleaned = phone.toString().trim().replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
}

/**
 * Mengambil konfigurasi WA Scheduler dari database (pengaturan_absensi_otomatis) dengan fallback default
 */
export async function getWaSchedulerConfig(): Promise<WaSchedulerConfig> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis 
       WHERE nama_pengaturan IN ('wa_scheduler_api_key', 'wa_scheduler_endpoint', 'wa_scheduler_lead_time', 'wa_scheduler_is_loop')`
    );

    const configMap: Record<string, string> = {};
    rows.forEach(r => {
      configMap[r.nama_pengaturan] = r.nilai;
    });

    const apiKey = configMap['wa_scheduler_api_key']?.trim() || DEFAULT_WA_SCHEDULER_KEY;
    const endpoint = configMap['wa_scheduler_endpoint']?.trim() || DEFAULT_WA_SCHEDULER_ENDPOINT;
    const leadTimeParsed = parseInt(configMap['wa_scheduler_lead_time'] || '15', 10);
    const leadTimeMinutes = isNaN(leadTimeParsed) ? 15 : leadTimeParsed;
    const isLoop = configMap['wa_scheduler_is_loop'] === '1' ? 1 : 0;

    return {
      apiKey,
      endpoint,
      leadTimeMinutes,
      isLoop
    };
  } catch (error) {
    console.error('Error fetching WA scheduler config from DB, using fallback:', error);
    return {
      apiKey: DEFAULT_WA_SCHEDULER_KEY,
      endpoint: DEFAULT_WA_SCHEDULER_ENDPOINT,
      leadTimeMinutes: 15,
      isLoop: 1
    };
  }
}

/**
 * Menghitung format scheduled_time (YYYY-MM-DDTHH:MM) dalam zona waktu Asia/Jakarta (WIB)
 * @param jamStr Format HH:mm atau HH:mm:ss
 * @param leadMinutes Jumlah menit sebelum jam mulai pengiriman dilakukan
 * @param targetDateStr Tanggal target YYYY-MM-DD (default hari ini WIB)
 */
export function calculateScheduledTimeWIB(
  jamStr: string,
  leadMinutes: number = 0,
  targetDateStr?: string
): string {
  // Dapatkan tanggal hari ini dalam WIB jika tidak dispesifikasikan
  const todayWIB = targetDateStr || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
  
  const [hStr, mStr] = jamStr.split(':');
  const hours = parseInt(hStr || '0', 10);
  const minutes = parseInt(mStr || '0', 10);

  // Buat objek Date berbasis WIB
  const targetDate = new Date(`${todayWIB}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+07:00`);
  
  // Kurangkan waktu leadMinutes
  if (leadMinutes > 0) {
    targetDate.setMinutes(targetDate.getMinutes() - leadMinutes);
  }

  // Format ke YYYY-MM-DDTHH:MM berbasis WIB
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const finalHours = String(targetDate.getHours()).padStart(2, '0');
  const finalMinutes = String(targetDate.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${finalHours}:${finalMinutes}`;
}

/**
 * Membersihkan teks dari karakter non-Latin (seperti teks Arab) yang menyebabkan tanda tanya '????'
 * pada server database gateway WhatsApp yang belum mendukung charset utf8mb4.
 */
export function sanitizeTextForWaScheduler(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // Konversi salam & frasa bahasa Arab ke tulisan Latin yang rapi dan lengkap
  sanitized = sanitized
    .replace(/[<>]+\s*السلام\s*عليكم\s*ورحمة\s*الله\s*وبركاته\s*[<>]+/gi, "Assalamu'alaikum Warohmatullah,")
    .replace(/[<>]+\s*السلام\s*عليكم\s*ورحمة\s*الله\s*[<>]+/gi, "Assalamu'alaikum Warohmatullah,")
    .replace(/[<>]+\s*السلام\s*عليكم\s*[<>]+/gi, "Assalamu'alaikum Warohmatullah,")
    .replace(/السلام\s*عليكم\s*ورحمة\s*الله\s*وبركاته/gi, "Assalamu'alaikum Warohmatullah,")
    .replace(/السلام\s*عليكم\s*ورحمة\s*الله/gi, "Assalamu'alaikum Warohmatullah,")
    .replace(/السلام\s*عليكم/gi, "Assalamu'alaikum Warohmatullah,")
    .replace(/والسلام\s*عليكم\s*ورحمة\s*الله\s*وبركاته/gi, "Wassalamu'alaikum Warohmatullah,")
    .replace(/والسلام\s*عليكم\s*ورحمة\s*الله/gi, "Wassalamu'alaikum Warohmatullah,")
    .replace(/والسلام\s*عليكم/gi, "Wassalamu'alaikum Warohmatullah,")
    .replace(/وعليكم\s*السلام\s*ورحمة\s*الله\s*وبركاته/gi, "Wa'alaikumussalam Warohmatullah,")
    .replace(/وعليكم\s*السلام/gi, "Wa'alaikumussalam Warohmatullah,")
    .replace(/جزاكم\s*الله\s*خيرا/gi, "Jazakumullah Khairan")
    .replace(/بارك\s*الله\s*فيكم/gi, "Barakallahu Fiikum")
    .replace(/إن\s*شاء\s*الله/gi, "Insya Allah")
    .replace(/الحمد\s*لله/gi, "Alhamdulillah")
    .replace(/أستغفر\s*الله/gi, "Astaghfirullah")
    .replace(/سبحان\s*الله/gi, "Subhanallah")
    .replace(/الله\s*أكبر/gi, "Allahu Akbar");

  // Jika masih ada karakter Arab lain yang tersisa, bersihkan agar tidak jadi '????'
  sanitized = sanitized.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').trim();

  // Rapikan tanda kurung kosong jika tersisa seperti <  > atau > <
  sanitized = sanitized.replace(/<\s*>/g, '').replace(/>\s*</g, '').replace(/\n{3,}/g, '\n\n');

  return sanitized;
}

/**
 * Mengirim request penjadwalan pesan ke wa.quizb.my.id API
 */
export async function sendWaSchedule(options: SendWaScheduleOptions): Promise<{
  success: boolean;
  message: string;
  data?: any;
  statusHttp?: number;
}> {
  const formattedPhone = formatToWaPhone(options.phone_number);
  if (!formattedPhone || formattedPhone.length < 9) {
    return {
      success: false,
      message: `Nomor telepon tidak valid: "${options.phone_number}"`
    };
  }

  if (!options.message || options.message.trim() === '') {
    return {
      success: false,
      message: 'Pesan tidak boleh kosong'
    };
  }

  const cleanMessage = sanitizeTextForWaScheduler(options.message);

  const apiKey = options.apiKey || DEFAULT_WA_SCHEDULER_KEY;
  const endpoint = options.endpoint || DEFAULT_WA_SCHEDULER_ENDPOINT;

  const payload: any = {
    phone_number: formattedPhone,
    message: cleanMessage,
    scheduled_time: options.scheduled_time,
  };

  if (options.is_loop !== undefined) {
    payload.is_loop = options.is_loop;
  }
  if (options.loop_interval) {
    payload.loop_interval = options.loop_interval;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const resJson = await res.json().catch(() => null);

    if (res.ok && resJson && resJson.status === 'success') {
      return {
        success: true,
        message: resJson.message || 'Jadwal pesan berhasil dibuat di WA Scheduler',
        data: resJson.data,
        statusHttp: res.status
      };
    } else {
      const errMsg = resJson?.message || `Gagal mengirim ke WA Scheduler (HTTP ${res.status})`;
      return {
        success: false,
        message: errMsg,
        data: resJson,
        statusHttp: res.status
      };
    }
  } catch (error: any) {
    console.error('Error calling WA Scheduler API:', error);
    return {
      success: false,
      message: 'Gagal terhubung ke server WA Scheduler: ' + (error.message || 'Koneksi terputus')
    };
  }
}
