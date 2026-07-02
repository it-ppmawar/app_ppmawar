import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { verifyToken } from '@/lib/auth/jwt';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Hanya admin atau staff yang dapat melakukan aksi ini' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ids } = body; 
    const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'ID Murid tidak valid' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let successCount = 0;

      for (const currentId of targetIds) {
        const [muridRows] = await connection.execute<RowDataPacket[]>(
          `SELECT m.*, km.nama_kamar, kmd.nama_kelas as nama_kelas_madin, kq.nama_kelas as nama_kelas_quran 
           FROM murid m
           LEFT JOIN kamar km ON m.kamar_id = km.kamar_id
           LEFT JOIN kelas_madin kmd ON m.kelas_madin_id = kmd.kelas_id
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE m.murid_id = ?`, 
          [currentId]
        );
        if (muridRows.length === 0) continue;
        const murid = muridRows[0];

        const tahunMasuk = murid.created_at ? new Date(murid.created_at).getFullYear() : new Date().getFullYear() - 3;
        const tahunKeluar = new Date().getFullYear();

        // Susun string riwayat pendidikan terakhir
        const parts = [];
        if (murid.nama_kamar) parts.push(`Kamar: ${murid.nama_kamar}`);
        if (murid.nama_kelas_madin) parts.push(`Madin: ${murid.nama_kelas_madin}`);
        if (murid.nama_kelas_quran) parts.push(`Qur'an: ${murid.nama_kelas_quran}`);
        const riwayat = parts.length > 0 ? parts.join(' | ') : 'Tidak ada riwayat kelas';

        await connection.execute(
          `INSERT INTO alumni (nama, nis, nik, no_hp, alamat, tahun_masuk, tahun_keluar, status_keluar, foto, jenis_kelamin, kategori_mukim, keterangan, last_kamar_id, last_kelas_madin_id, last_kelas_quran_id, nama_panggilan, barcode_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Lulus', ?, ?, 'PPM', ?, ?, ?, ?, ?, ?)`,
          [
            murid.nama, 
            murid.nis || '', 
            murid.nik || null, 
            murid.no_hp || null, 
            murid.alamat || null, 
            tahunMasuk, 
            tahunKeluar, 
            murid.foto || null, 
            murid.jenis_kelamin || null,
            riwayat,
            murid.kamar_id || null,
            murid.kelas_madin_id || null,
            murid.kelas_quran_id || null,
            murid.nama_panggilan || null,
            murid.barcode_id || null
          ]
        );

        await connection.execute('DELETE FROM users WHERE murid_id = ?', [murid.murid_id]);
        await connection.execute('DELETE FROM murid WHERE murid_id = ?', [murid.murid_id]);
        
        successCount++;
      }

      await connection.commit();
      connection.release();

      if (successCount === 0) {
        return NextResponse.json({ error: 'Tidak ada data murid yang diproses' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: `${successCount} Santri berhasil diluluskan, dipindah ke daftar Alumni, dan User terkait telah dihapus.` });
    } catch (error: any) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error: any) {
    console.error('Error luluskan murid:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
