import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    // 1. Ambil kegiatan asrama
    const [kegiatanRows] = await db.query<RowDataPacket[]>(
      'SELECT DISTINCT kegiatan_id, nama_kegiatan, hari, jam_mulai, jam_selesai FROM jadwal_kegiatan ORDER BY nama_kegiatan ASC'
    );

    // 2. Ambil jadwal madin (gabung dengan kelas_madin)
    const [madinRows] = await db.query<RowDataPacket[]>(
      `SELECT j.jadwal_id, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, km.nama_kelas 
       FROM jadwal_madin j 
       JOIN kelas_madin km ON j.kelas_madin_id = km.kelas_id 
       ORDER BY km.nama_kelas ASC, j.hari ASC`
    );

    // 3. Ambil jadwal quran (gabung dengan kelas_quran)
    const [quranRows] = await db.query<RowDataPacket[]>(
      `SELECT j.id as jadwal_id, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, kq.nama_kelas 
       FROM jadwal_quran j 
       JOIN kelas_quran kq ON j.kelas_quran_id = kq.id 
       ORDER BY kq.nama_kelas ASC, j.hari ASC`
    );

    // Format list kegiatan murni (kompatibilitas lama)
    const kegiatan = Array.from(new Set(kegiatanRows.map(r => r.nama_kegiatan)));

    // Format list lengkap terstruktur untuk dropdown scan universal
    const allSchedules = [
      ...kegiatanRows.map(r => ({
        id: `kegiatan:${r.kegiatan_id}`,
        nama: r.nama_kegiatan,
        label: `🕌 [Asrama] ${r.nama_kegiatan} (${r.hari || 'Setiap Hari'})`,
        tipe: 'kegiatan'
      })),
      ...madinRows.map(r => ({
        id: `madin:${r.jadwal_id}`,
        nama: `Madin - ${r.nama_kelas} (${r.mata_pelajaran})`,
        label: `📖 [Madin] ${r.nama_kelas} — ${r.mata_pelajaran} (${r.hari})`,
        tipe: 'madin'
      })),
      ...quranRows.map(r => ({
        id: `quran:${r.jadwal_id}`,
        nama: `Qur'an - ${r.nama_kelas} (${r.mata_pelajaran})`,
        label: `📘 [Qur'an] ${r.nama_kelas} — ${r.mata_pelajaran} (${r.hari})`,
        tipe: 'quran'
      }))
    ];

    return NextResponse.json({ 
      success: true, 
      kegiatan, 
      allSchedules 
    });

  } catch (error: any) {
    console.error('API Kegiatan List Error:', error);
    return NextResponse.json({ success: false, message: 'Server error: ' + error.message }, { status: 500 });
  }
}
