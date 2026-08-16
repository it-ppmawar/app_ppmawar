import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getActivePendingReminders, ActivePendingReminder } from '@/lib/jadwal/activeReminders';
import { 
  sendWaSchedule, 
  getWaSchedulerConfig, 
  calculateScheduledTimeWIB, 
  formatToWaPhone 
} from '@/lib/services/waScheduler';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload as any;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Hanya Admin/Staff yang dapat menjadwalkan notifikasi massal' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { 
      mode = 'active_today', // 'active_today' | 'all_schedules' | 'custom_list'
      customItems = [],
      categories = ['madin', 'quran', 'kamar'],
      leadTimeMinutes: customLeadTime,
      isLoop: customIsLoop,
      loopInterval = 'daily',
      customTemplate
    } = body;

    const config = await getWaSchedulerConfig();
    const effectiveLeadTime = typeof customLeadTime === 'number' ? customLeadTime : config.leadTimeMinutes;
    const effectiveIsLoop = customIsLoop !== undefined ? (customIsLoop ? 1 : 0) : config.isLoop;

    const todayDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
    const formatterDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    let currentDay = formatterDay.format(new Date());
    if (currentDay === 'Minggu') currentDay = 'Ahad';

    const defaultGuruTemplate = `Assalamu'alaikum Warohmatullah, Ustadz/Ustadzah *{nama_guru}*.\n\nKami dari pengurus PPMA menginformasikan pengingat jadwal mengajar/tugas Anda:\n\n* Hari/Tanggal: {hari_tanggal}\n* Kategori: {kegiatan}\n* {label_mapel}: {mapel}\n* Tempat/Kelas: {kelas}\n* Jam: {jam}\n\nLink Absensi: {link_absen}\n\nMohon untuk mengisi absensi tepat waktu. Atas perhatiannya kami ucapkan terima kasih.\n\nWassalamu'alaikum Warohmatullah.`;
    const templateToUse = customTemplate || defaultGuruTemplate;

    let itemsToSchedule: {
      guru_nama: string;
      guru_whatsapp: string;
      kelas_nama: string;
      mata_pelajaran: string;
      jam_mulai: string;
      jam_selesai: string;
      hari: string;
      tipe: string;
      quick_url: string;
    }[] = [];

    const activeCategories = Array.isArray(categories) && categories.length > 0 ? categories : ['madin', 'quran', 'kamar'];

    if (mode === 'active_today') {
      // 1. Ambil pengingat aktif yang belum diabsen hari ini
      const activeReminders = await getActivePendingReminders();
      const filteredReminders = activeReminders.filter(r => activeCategories.includes(r.tipe));
      itemsToSchedule = filteredReminders.map(r => ({
        guru_nama: r.guru_nama,
        guru_whatsapp: r.guru_whatsapp,
        kelas_nama: r.kelas_nama,
        mata_pelajaran: r.mata_pelajaran,
        jam_mulai: r.jam_mulai,
        jam_selesai: r.jam_selesai,
        hari: r.hari,
        tipe: r.tipe,
        quick_url: r.quick_url || 'https://app.ppmawar.or.id/'
      }));
    } else if (mode === 'all_schedules') {
      // 2. Ambil jadwal sesuai kategori terpilih (Madin, Quran, Kegiatan) untuk penjadwalan harian / mingguan
      const appendRows = (rows: any[], tipe: string) => {
        for (const row of rows) {
          const quickPayload = {
            type: 'quick_absen',
            guru_id: row.guru_id,
            guru_nama: row.guru_nama || 'Tanpa Nama',
            jadwal_id: Number(row.jadwal_id),
            tipe,
            date: todayDateStr,
            waktu_tenggang: 3
          };
          const quick_token = signToken(quickPayload, '7d');
          const quick_url = `https://app.ppmawar.or.id/absen/quick?token=${quick_token}`;

          itemsToSchedule.push({
            guru_nama: row.guru_nama,
            guru_whatsapp: row.guru_whatsapp,
            kelas_nama: row.kelas_nama,
            mata_pelajaran: row.mata_pelajaran,
            jam_mulai: row.jam_mulai,
            jam_selesai: row.jam_selesai,
            hari: row.hari,
            tipe,
            quick_url
          });
        }
      };

      if (activeCategories.includes('madin')) {
        const queryMadin = `
          SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
                 m.nama_kelas as kelas_nama, j.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
          FROM jadwal_madin j
          JOIN kelas_madin m ON j.kelas_madin_id = m.kelas_id
          JOIN guru g ON j.guru_id = g.guru_id
          WHERE g.no_hp IS NOT NULL AND g.no_hp != ''
        `;
        const [madinRows] = await pool.execute<RowDataPacket[]>(queryMadin);
        appendRows(madinRows, 'madin');
      }

      if (activeCategories.includes('quran')) {
        const queryQuran = `
          SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
                 q.nama_kelas as kelas_nama, j.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
          FROM jadwal_quran j
          JOIN kelas_quran q ON j.kelas_quran_id = q.id
          JOIN guru g ON j.guru_id = g.guru_id
          WHERE g.no_hp IS NOT NULL AND g.no_hp != ''
        `;
        const [quranRows] = await pool.execute<RowDataPacket[]>(queryQuran);
        appendRows(quranRows, 'quran');
      }

      if (activeCategories.includes('kamar')) {
        const queryKegiatan = `
          SELECT jk.kegiatan_id as jadwal_id, jk.jam_mulai, jk.jam_selesai, jk.nama_kegiatan as mata_pelajaran, jk.hari,
                 k.nama_kamar as kelas_nama, jk.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp
          FROM jadwal_kegiatan jk
          JOIN kamar k ON jk.kamar_id = k.kamar_id
          JOIN guru g ON jk.guru_id = g.guru_id
          WHERE g.no_hp IS NOT NULL AND g.no_hp != ''
        `;
        const [kegiatanRows] = await pool.execute<RowDataPacket[]>(queryKegiatan);
        appendRows(kegiatanRows, 'kamar');
      }

      // Gabungkan jadwal guru yang mengajar di jam, hari, dan tipe yang sama agar tidak duplikat kirim
      const mergedMap = new Map<string, typeof itemsToSchedule[0]>();
      for (const item of itemsToSchedule) {
        const phone = formatToWaPhone(item.guru_whatsapp);
        const key = `${phone}_${item.tipe}_${item.hari}_${item.jam_mulai}_${item.jam_selesai}`;
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          if (item.kelas_nama && !existing.kelas_nama.includes(item.kelas_nama)) {
            existing.kelas_nama = `${existing.kelas_nama} & ${item.kelas_nama}`;
          }
          if (item.mata_pelajaran && !existing.mata_pelajaran.includes(item.mata_pelajaran)) {
            existing.mata_pelajaran = `${existing.mata_pelajaran} & ${item.mata_pelajaran}`;
          }
        } else {
          mergedMap.set(key, { ...item });
        }
      }
      itemsToSchedule = Array.from(mergedMap.values());
    } else if (mode === 'custom_list' && Array.isArray(customItems)) {
      itemsToSchedule = customItems;
    }

    if (itemsToSchedule.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada jadwal pengingat yang memenuhi kriteria untuk dikirimkan.',
        total: 0,
        sent: 0,
        failed: 0,
        results: []
      });
    }

    // Proses pengiriman antrean ke WA Scheduler secara paralel chunk (concurrency: 5) untuk mencegah timeout server
    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    const processSingleItem = async (item: typeof itemsToSchedule[0]) => {
      const formattedPhone = formatToWaPhone(item.guru_whatsapp);
      if (!formattedPhone || formattedPhone.length < 9) {
        failCount++;
        return {
          guru_nama: item.guru_nama,
          phone: item.guru_whatsapp,
          success: false,
          error: 'Nomor WhatsApp tidak valid atau kosong'
        };
      }

      // Bangun teks pesan dari template dengan label spesifik (Mapel / Majlis / Kegiatan)
      const t = (item.tipe || '').toLowerCase();
      let labelMapel = 'Mapel';
      let kegiatanLabel = 'Madin';
      let valMapel = item.mata_pelajaran || '-';

      if (t.includes('quran') || t.includes('qur_an')) {
        labelMapel = 'Majlis';
        kegiatanLabel = "Al-Qur'an";
        valMapel = item.mata_pelajaran || item.kelas_nama || "Majlis Qur'an";
      } else if (t.includes('kamar') || t.includes('kegiatan') || t.includes('asrama')) {
        labelMapel = 'Kegiatan';
        kegiatanLabel = 'Asrama';
        valMapel = item.mata_pelajaran || 'Kegiatan Asrama';
      } else {
        labelMapel = 'Mapel';
        kegiatanLabel = 'Madin';
        valMapel = item.mata_pelajaran || 'Pelajaran Diniyah';
      }

      const jamLabel = `${item.jam_mulai ? item.jam_mulai.substring(0, 5) : '-'} - ${item.jam_selesai ? item.jam_selesai.substring(0, 5) : '-'}`;

      let messageText = templateToUse
        .replace(/{nama_guru}/g, item.guru_nama || 'Ustadz/Ustadzah')
        .replace(/{hari}/g, item.hari || currentDay)
        .replace(/{hari_tanggal}/g, `${item.hari || currentDay}, ${todayDateStr}`)
        .replace(/{kegiatan}/g, kegiatanLabel)
        .replace(/{label_mapel}/g, labelMapel)
        .replace(/{mapel}/g, valMapel)
        .replace(/{kelas}/g, item.kelas_nama || '-')
        .replace(/{jam}/g, jamLabel)
        .replace(/{link_absen}/g, item.quick_url || 'https://app.ppmawar.or.id/');

      // Jika templat lama belum memuat baris Mapel/Majlis/Kegiatan, sisipkan secara otomatis di bawah baris Kategori
      if (!messageText.includes(labelMapel) && !messageText.includes(valMapel) && valMapel !== '-') {
        messageText = messageText.replace(
          new RegExp(`(\\* Kategori:.*?\\n)`, 'i'),
          `$1* ${labelMapel}: ${valMapel}\n`
        );
      }

      // Tentukan waktu scheduled_time
      const rawJam = item.jam_mulai || '07:00';
      let scheduleTimeStr = calculateScheduledTimeWIB(rawJam, effectiveLeadTime, todayDateStr);

      // Pastikan scheduled_time tidak di masa lalu jika loop = 0
      if (effectiveIsLoop === 0) {
        const scheduleDate = new Date(scheduleTimeStr + ':00+07:00');
        const nowWIB = new Date();
        if (scheduleDate.getTime() <= nowWIB.getTime()) {
          const nextMin = new Date(nowWIB.getTime() + 2 * 60 * 1000);
          const y = nextMin.getFullYear();
          const m = String(nextMin.getMonth() + 1).padStart(2, '0');
          const d = String(nextMin.getDate()).padStart(2, '0');
          const h = String(nextMin.getHours()).padStart(2, '0');
          const min = String(nextMin.getMinutes()).padStart(2, '0');
          scheduleTimeStr = `${y}-${m}-${d}T${h}:${min}`;
        }
      }

      const sendResult = await sendWaSchedule({
        phone_number: formattedPhone,
        message: messageText,
        scheduled_time: scheduleTimeStr,
        is_loop: effectiveIsLoop as 0 | 1,
        loop_interval: loopInterval as any,
        apiKey: config.apiKey,
        endpoint: config.endpoint
      });

      if (sendResult.success) {
        successCount++;
        return {
          guru_nama: item.guru_nama,
          phone: formattedPhone,
          scheduled_time: scheduleTimeStr,
          success: true,
          data: sendResult.data
        };
      } else {
        failCount++;
        return {
          guru_nama: item.guru_nama,
          phone: formattedPhone,
          scheduled_time: scheduleTimeStr,
          success: false,
          error: sendResult.message
        };
      }
    };

    // Eksekusi secara batch paralel per 5 item
    const chunkSize = 5;
    for (let i = 0; i < itemsToSchedule.length; i += chunkSize) {
      const chunk = itemsToSchedule.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(item => processSingleItem(item)));
      results.push(...chunkResults);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memproses ${itemsToSchedule.length} jadwal (${successCount} terjadwal, ${failCount} gagal/invalid)`,
      total: itemsToSchedule.length,
      sent: successCount,
      failed: failCount,
      results
    });
  } catch (error: any) {
    console.error('Error in /api/wa-scheduler/bulk-reminder:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
