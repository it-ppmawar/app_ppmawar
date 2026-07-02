import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

// Helper to verify admin/staff role
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

// GET: Get all alumni or search
export async function GET(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const kategori = searchParams.get('kategori') || '';

    let sql = 'SELECT * FROM alumni WHERE 1=1';
    let params: any[] = [];

    if (search) {
      sql += ' AND (nama LIKE ? OR nis LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (kategori === 'PPM' || kategori === 'LPPM') {
      sql += ' AND kategori_mukim = ?';
      params.push(kategori);
    }

    sql += ' ORDER BY tahun_keluar DESC, nama ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error GET /api/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// PUT: Update alumni data
export async function PUT(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      alumni_id,
      nama,
      nis,
      nik,
      no_hp,
      alamat,
      tahun_masuk,
      tahun_keluar,
      status_keluar,
      jenis_kelamin,
      kategori_mukim,
      keterangan
    } = body;

    if (!alumni_id || !nama || !nis) {
      return NextResponse.json({ error: 'Data wajib (Nama, NIS) belum lengkap' }, { status: 400 });
    }

    const sql = `
      UPDATE alumni 
      SET nama = ?, nis = ?, nik = ?, no_hp = ?, alamat = ?, 
          tahun_masuk = ?, tahun_keluar = ?, status_keluar = ?,
          jenis_kelamin = ?, kategori_mukim = ?, keterangan = ?
      WHERE alumni_id = ?
    `;
    const params = [
      nama,
      nis,
      nik || null,
      no_hp || null,
      alamat || null,
      tahun_masuk || null,
      tahun_keluar || null,
      status_keluar || 'Lulus',
      jenis_kelamin || null,
      kategori_mukim || 'PPM',
      keterangan || null,
      alumni_id
    ];

    const [result] = await pool.execute<ResultSetHeader>(sql, params);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data alumni tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data alumni berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error PUT /api/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// DELETE: Delete alumni permanently
export async function DELETE(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID Alumni tidak valid' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM alumni WHERE alumni_id = ?', [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data alumni tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data alumni berhasil dihapus permanen' });
  } catch (error: any) {
    console.error('Error DELETE /api/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
