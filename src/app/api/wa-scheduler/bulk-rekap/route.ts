import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { 
  sendWaSchedule, 
  getWaSchedulerConfig, 
  calculateScheduledTimeWIB, 
  formatToWaPhone,
  sanitizeTextForWaScheduler 
} from '@/lib/services/waScheduler';

export const dynamic = 'force-dynamic';

const NAMA_BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DEFAULT_REKAP_TEMPLATE = 
`Assalamu'alaikum Warohmatullah,

Yth. {nama_guru}

Berikut kami sampaikan Rekapitulasi Absensi Mengajar Anda untuk periode {bulan_tahun}:

📚 *Daftar Kelas & Mapel yang Diampu:*
{daftar_kelas}

📊 *Ringkasan Kehadiran Mengajar:*
{ringkasan_kehadiran}

🔗 *Link Preview Detail Rekapitulasi:*
{link_rekap}

Silakan klik tautan di atas untuk melihat rincian presensi kehadiran santri per kelas yang Anda ampu atau mengunduh ringkasannya.

Wassalamu'alaikum Warohmatullah,
_Pengurus PP. Matholi'ul Anwar_`;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Hanya Admin/Staff yang dapat mengirim siaran rekapitulasi massal' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const bulan = Number(body.bulan || currentMonth);
    const tahun = Number(body.tahun || currentYear);
    const categories: string[] = Array.isArray(body.categories) && body.categories.length > 0
      ? body.categories
      : ['madin'];
    const customTemplate = body.template || DEFAULT_REKAP_TEMPLATE;
    const mode: 'send_now' | 'schedule_monthly' = body.mode || 'send_now';
    const isLoop = mode === 'schedule_monthly' ? 1 : 0;
    const loopInterval = mode === 'schedule_monthly' ? 'monthly' : undefined;

    const bulanTahunStr = `${NAMA_BULAN[bulan] || `Bulan ${bulan}`} ${tahun}`;

    // 1. Ambil daftar seluruh guru yang memiliki jadwal di kategori terpilih
    interface GuruScheduleItem {
      guru_id: number;
      guru_nama: string;
      guru_whatsapp: string;
      tipe: string;
      kelas_nama: string;
      mata_pelajaran: string;
    }

    const guruMap = new Map<number, {
      guru_id: number;
      guru_nama: string;
      guru_whatsapp: string;
      classes: { tipe: string; kelas_nama: string; mata_pelajaran: string }[];
    }>();

    // Query Madin
    if (categories.includes('madin')) {
      const [madinRows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT g.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp,
                km.nama_kelas as kelas_nama, j.mata_pelajaran
         FROM jadwal_madin j
         JOIN kelas_madin km ON j.kelas_madin_id = km.kelas_id
         JOIN guru g ON j.guru_id = g.guru_id
         WHERE g.no_hp IS NOT NULL AND g.no_hp != ''`
      );
      for (const row of madinRows) {
        const gid = row.guru_id;
        if (!guruMap.has(gid)) {
          guruMap.set(gid, {
            guru_id: gid,
            guru_nama: row.guru_nama,
            guru_whatsapp: row.guru_whatsapp,
            classes: [],
          });
        }
        guruMap.get(gid)!.classes.push({
          tipe: 'Madin',
          kelas_nama: row.kelas_nama,
          mata_pelajaran: row.mata_pelajaran,
        });
      }
    }

    // Query Quran
    if (categories.includes('quran')) {
      const [quranRows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT g.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp,
                kq.nama_kelas as kelas_nama, j.mata_pelajaran
         FROM jadwal_quran j
         JOIN kelas_quran kq ON j.kelas_quran_id = kq.id
         JOIN guru g ON j.guru_id = g.guru_id
         WHERE g.no_hp IS NOT NULL AND g.no_hp != ''`
      );
      for (const row of quranRows) {
        const gid = row.guru_id;
        if (!guruMap.has(gid)) {
          guruMap.set(gid, {
            guru_id: gid,
            guru_nama: row.guru_nama,
            guru_whatsapp: row.guru_whatsapp,
            classes: [],
          });
        }
        guruMap.get(gid)!.classes.push({
          tipe: "Qur'an",
          kelas_nama: row.kelas_nama,
          mata_pelajaran: row.mata_pelajaran || 'Tahfidz / Tilawah',
        });
      }
    }

    // Query Kamar / Asrama
    if (categories.includes('kamar')) {
      const [kamarRows] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT g.guru_id, g.nama as guru_nama, g.no_hp as guru_whatsapp,
                k.nama_kamar as kelas_nama, jk.nama_kegiatan as mata_pelajaran
         FROM jadwal_kegiatan jk
         JOIN kamar k ON jk.kamar_id = k.kamar_id
         JOIN guru g ON jk.guru_id = g.guru_id
         WHERE g.no_hp IS NOT NULL AND g.no_hp != ''`
      );
      for (const row of kamarRows) {
        const gid = row.guru_id;
        if (!guruMap.has(gid)) {
          guruMap.set(gid, {
            guru_id: gid,
            guru_nama: row.guru_nama,
            guru_whatsapp: row.guru_whatsapp,
            classes: [],
          });
        }
        guruMap.get(gid)!.classes.push({
          tipe: 'Asrama',
          kelas_nama: row.kelas_nama,
          mata_pelajaran: row.mata_pelajaran || 'Kegiatan',
        });
      }
    }

    const guruList = Array.from(guruMap.values());
    if (guruList.length === 0) {
      return NextResponse.json({ error: 'Tidak ada guru dengan nomor WhatsApp valid pada kategori terpilih' }, { status: 400 });
    }

    // 2. Ambil ringkasan kehadiran mengajar untuk semua guru ini di bulan/tahun terpilih
    const guruIds = guruList.map(g => g.guru_id);
    const placeholders = guruIds.map(() => '?').join(',');
    const [attendanceRows] = await pool.execute<RowDataPacket[]>(
      `SELECT guru_id,
        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
        COUNT(*) as total_sesi
       FROM absensi_guru
       WHERE guru_id IN (${placeholders}) AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?
       GROUP BY guru_id`,
      [...guruIds, bulan, tahun]
    );

    const attendanceMap = new Map<number, any>();
    for (const r of attendanceRows) {
      attendanceMap.set(r.guru_id, r);
    }

    // 3. Tentukan waktu pengiriman:
    // Jika send_now: 2 menit dari sekarang
    // Jika schedule_monthly: tanggal 1 jam 08:00 WIB
    let scheduledTimeStr: string;
    if (mode === 'schedule_monthly') {
      // Tanggal 1 bulan berikutnya atau bulan ini
      const nextMonth = bulan === 12 ? 1 : bulan + 1;
      const nextYear = bulan === 12 ? tahun + 1 : tahun;
      scheduledTimeStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T08:00`;
    } else {
      const nowWIB = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      nowWIB.setMinutes(nowWIB.getMinutes() + 2);
      const year = nowWIB.getFullYear();
      const month = String(nowWIB.getMonth() + 1).padStart(2, '0');
      const day = String(nowWIB.getDate()).padStart(2, '0');
      const hours = String(nowWIB.getHours()).padStart(2, '0');
      const minutes = String(nowWIB.getMinutes()).padStart(2, '0');
      scheduledTimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // 4. Eksekusi pengiriman paralel per chunk
    const results: any[] = [];
    const chunkSize = 5;

    for (let i = 0; i < guruList.length; i += chunkSize) {
      const chunk = guruList.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (g) => {
        const phone = formatToWaPhone(g.guru_whatsapp);
        if (!phone) {
          return { guru_nama: g.guru_nama, phone: g.guru_whatsapp, success: false, error: 'Format No HP tidak valid' };
        }

        // Susun daftar kelas & mapel
        const classListFormatted = g.classes
          .map((c, idx) => `${idx + 1}. [${c.tipe}] ${c.kelas_nama} - ${c.mata_pelajaran}`)
          .join('\n');

        // Susun ringkasan kehadiran
        const att = attendanceMap.get(g.guru_id) || { hadir: 0, izin: 0, sakit: 0, alpha: 0, total_sesi: 0 };
        const ringkasanFormatted = 
`• Hadir Mengajar: ${att.hadir} sesi
• Izin: ${att.izin} sesi
• Sakit: ${att.sakit} sesi
• Tanpa Keterangan: ${att.alpha} sesi`;

        // Buat JWT Token khusus rekap guru (berlaku 30 hari)
        const rekapToken = signToken({
          type: 'rekap_guru',
          guru_id: g.guru_id,
          bulan,
          tahun,
          categories,
        }, '30d');

        const quickUrl = `https://app.ppmawar.or.id/rekap/guru?token=${rekapToken}`;

        // Render template
        let msg = customTemplate
          .replace(/{nama_guru}/g, `*${g.guru_nama}*`)
          .replace(/{bulan_tahun}/g, `*${bulanTahunStr}*`)
          .replace(/{daftar_kelas}/g, classListFormatted)
          .replace(/{ringkasan_kehadiran}/g, ringkasanFormatted)
          .replace(/{link_rekap}/g, quickUrl);

        // Sanitize
        msg = sanitizeTextForWaScheduler(msg);

        const sendRes = await sendWaSchedule({
          phone_number: phone,
          message: msg,
          scheduled_time: scheduledTimeStr,
          is_loop: isLoop,
          loop_interval: loopInterval,
        });

        return {
          guru_nama: g.guru_nama,
          phone,
          success: sendRes.success,
          scheduled_time: scheduledTimeStr,
          error: sendRes.success ? undefined : sendRes.message,
        };
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Berhasil memproses siaran rekapitulasi untuk ${successCount} guru (${failedCount} gagal/invalid).`,
      total: results.length,
      successCount,
      failedCount,
      results,
    });

  } catch (error: any) {
    console.error('[wa-scheduler/bulk-rekap] Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
