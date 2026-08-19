import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { 
  sendWaSchedule, 
  formatToWaPhone,
  sanitizeTextForWaScheduler 
} from '@/lib/services/waScheduler';

export const dynamic = 'force-dynamic';

const NAMA_BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DEFAULT_KEPALA_MADIN_TEMPLATE = 
`Assalamu'alaikum Warohmatullah,

Yth. *Kepala Madrasah Diniyah (Madin)*
Pondok Pesantren Matholi'ul Anwar

Berikut kami sampaikan Laporan Rekapitulasi Kehadiran Dewan Guru Madin untuk periode {bulan_tahun}:

📊 *Ringkasan Presensi Dewan Guru Madin:*
• Total Dewan Guru: {total_guru} Guru
• Rata-rata Kehadiran: {avg_kehadiran}%
{ringkasan_kehadiran}

🔗 *Link Preview Detail Evaluasi Dewan Guru:*
{link_laporan}

Tautan di atas berisi daftar lengkap kehadiran masing-masing guru, rincian jadwal kelas yang diampu, serta fitur ekspor/cetak laporan resmi untuk evaluasi madrasah.

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
      return NextResponse.json({ error: 'Hanya Admin/Staff yang dapat mengirim laporan ke Kepala Madin' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const bulan = Number(body.bulan || currentMonth);
    const tahun = Number(body.tahun || currentYear);
    const targetWilayah: 'putra' | 'putri' | 'all' = body.target_wilayah || 'putra';
    const kepalaNama = body.kepala_nama || (targetWilayah === 'putri' ? 'Kepala Madin Putri' : targetWilayah === 'putra' ? 'Kepala Madin Putra' : 'Kepala Madrasah Diniyah');
    const rawPhone = body.phone_number;
    const customTemplate = body.template || DEFAULT_KEPALA_MADIN_TEMPLATE;
    const mode: 'send_now' | 'schedule_monthly' = body.mode || 'send_now';

    const phone = formatToWaPhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ error: 'Nomor WhatsApp Kepala Madin tidak valid atau belum diisi' }, { status: 400 });
    }

    const bulanTahunStr = `${NAMA_BULAN[bulan] || `Bulan ${bulan}`} ${tahun}`;

    let targetWhere = '';
    let wilayahSub = '';
    if (targetWilayah === 'putra') {
      targetWhere = `WHERE (km.nama_kelas LIKE '%PUTRA%' OR km.nama_kelas LIKE '%PA%')`;
      wilayahSub = ' (Madin Putra)';
    } else if (targetWilayah === 'putri') {
      targetWhere = `WHERE (km.nama_kelas LIKE '%PUTRI%' OR km.nama_kelas LIKE '%PI%')`;
      wilayahSub = ' (Madin Putri)';
    }

    // 1. Hitung total guru Madin sesuai sasaran wilayah
    const [madinTeachers] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT jm.guru_id 
       FROM jadwal_madin jm
       JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
       ${targetWhere}`
    );
    const totalGuru = madinTeachers.length;

    // 2. Hitung ringkasan presensi guru Madin sesuai sasaran wilayah
    const guruIds = madinTeachers.map(t => t.guru_id);
    let totalHadir = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpha = 0;
    let totalSesi = 0;

    if (guruIds.length > 0) {
      const placeholders = guruIds.map(() => '?').join(',');
      const [attRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total_sesi
         FROM absensi_guru
         WHERE guru_id IN (${placeholders}) AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?`,
        [...guruIds, bulan, tahun]
      );

      const r = attRows[0] || {};
      totalHadir = Number(r.hadir || 0);
      totalIzin = Number(r.izin || 0);
      totalSakit = Number(r.sakit || 0);
      totalAlpha = Number(r.alpha || 0);
      totalSesi = totalHadir + totalIzin + totalSakit + totalAlpha;
    }

    const avgPct = totalSesi > 0 ? Math.round((totalHadir / totalSesi) * 100) : 0;

    const ringkasanFormatted = 
`• Total Sesi Terlaksana: ${totalSesi} Sesi
• Hadir: ${totalHadir} Sesi
• Izin / Sakit: ${totalIzin + totalSakit} Sesi
• Tanpa Keterangan: ${totalAlpha} Sesi`;

    // 3. Generate Token Kepala Madin (30 hari) dengan target_wilayah
    const reportToken = signToken({
      type: 'rekap_kepala_madin',
      bulan,
      tahun,
      target_wilayah: targetWilayah,
    }, '30d');

    const reportUrl = `https://app.ppmawar.or.id/rekap/kepala-madin?token=${reportToken}`;

    // 4. Render template
    let msg = customTemplate
      .replace(/{nama_kepala}/g, `*${kepalaNama}*`)
      .replace(/{bulan_tahun}/g, `*${bulanTahunStr}${wilayahSub}*`)
      .replace(/{total_guru}/g, String(totalGuru))
      .replace(/{avg_kehadiran}/g, String(avgPct))
      .replace(/{ringkasan_kehadiran}/g, ringkasanFormatted)
      .replace(/{link_laporan}/g, reportUrl);

    msg = sanitizeTextForWaScheduler(msg);

    // 5. Tentukan waktu pengiriman
    let scheduledTimeStr: string;
    const isLoop = mode === 'schedule_monthly' ? 1 : 0;
    const loopInterval = mode === 'schedule_monthly' ? 'monthly' : undefined;

    if (mode === 'schedule_monthly') {
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

    const sendRes = await sendWaSchedule({
      phone_number: phone,
      message: msg,
      scheduled_time: scheduledTimeStr,
      is_loop: isLoop,
      loop_interval: loopInterval,
    });

    if (!sendRes.success) {
      return NextResponse.json({ error: sendRes.message || 'Gagal mengirim pesan ke gateway WA' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Laporan rekapitulasi kehadiran dewan guru berhasil dijadwalkan untuk Kepala Madin (${phone}).`,
      data: {
        phone,
        scheduled_time: scheduledTimeStr,
        mode,
      }
    });

  } catch (error: any) {
    console.error('[wa-scheduler/rekap-kepala-madin] Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
