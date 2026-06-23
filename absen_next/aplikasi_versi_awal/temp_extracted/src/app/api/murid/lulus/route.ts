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
        const [muridRows] = await connection.execute<RowDataPacket[]>('SELECT * FROM murid WHERE murid_id = ?', [currentId]);
        if (muridRows.length === 0) continue;
        const murid = muridRows[0];

        const tahunMasuk = murid.created_at ? new Date(murid.created_at).getFullYear() : new Date().getFullYear() - 3;
        const tahunKeluar = new Date().getFullYear();

        await connection.execute(
          `INSERT INTO alumni (nama, nis, nik, no_hp, alamat, tahun_masuk, tahun_keluar, status_keluar, foto, jenis_kelamin)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Lulus', ?, ?)`,
          [murid.nama, murid.nis || '', murid.nik || null, murid.no_hp || null, murid.alamat || null, tahunMasuk, tahunKeluar, murid.foto || null, murid.jenis_kelamin || null]
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
