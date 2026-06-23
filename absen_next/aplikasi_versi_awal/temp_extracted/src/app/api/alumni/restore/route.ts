import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const { role } = payload as any;
  if (role !== 'admin' && role !== 'staff') return null;

  return payload;
}

export async function POST(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { alumni_id } = body;

    if (!alumni_id) {
      return NextResponse.json({ error: 'ID Alumni tidak valid' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Ambil data alumni
      const [alumniRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM alumni WHERE alumni_id = ?',
        [alumni_id]
      );

      if (alumniRows.length === 0) {
        connection.release();
        return NextResponse.json({ error: 'Data alumni tidak ditemukan' }, { status: 404 });
      }

      const alumni = alumniRows[0];

      // 2. Masukkan kembali ke tabel murid
      const insertSql = `
        INSERT INTO murid (nama, nis, nik, no_hp, alamat, foto, jenis_kelamin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const insertParams = [
        alumni.nama,
        alumni.nis || null,
        alumni.nik || null,
        alumni.no_hp || null,
        alumni.alamat || null,
        alumni.foto || null,
        alumni.jenis_kelamin || null
      ];

      const [insertResult] = await connection.execute<ResultSetHeader>(insertSql, insertParams);

      // 3. Hapus data dari tabel alumni
      await connection.execute('DELETE FROM alumni WHERE alumni_id = ?', [alumni_id]);

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        message: `Santri ${alumni.nama} berhasil dipulihkan sebagai murid aktif.`
      });
    } catch (dbError: any) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error POST /api/alumni/restore:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
