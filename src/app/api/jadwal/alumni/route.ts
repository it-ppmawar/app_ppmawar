import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload) return null;
  return payload;
}

// GET: Ambil semua jadwal alumni (siapa saja boleh akses tanpa login)
export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM jadwal_alumni ORDER BY jam_mulai ASC`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error GET /api/jadwal/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// POST: Tambah jadwal alumni (admin/staff only)
export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff' }, { status: 403 });
    }

    const body = await request.json();
    const { jam_mulai, jam_selesai, kegiatan, tempat, keterangan } = body;

    if (!jam_mulai || !jam_selesai || !kegiatan || !tempat) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    await pool.execute(
      `INSERT INTO jadwal_alumni (jam_mulai, jam_selesai, kegiatan, tempat, keterangan) VALUES (?, ?, ?, ?, ?)`,
      [jam_mulai, jam_selesai, kegiatan, tempat, keterangan || null]
    );

    return NextResponse.json({ success: true, message: 'Jadwal alumni berhasil ditambahkan' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// PUT: Edit jadwal alumni (admin/staff only)
export async function PUT(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff' }, { status: 403 });
    }

    const body = await request.json();
    const { id, jam_mulai, jam_selesai, kegiatan, tempat, keterangan } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID jadwal tidak valid' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE jadwal_alumni SET jam_mulai = ?, jam_selesai = ?, kegiatan = ?, tempat = ?, keterangan = ? WHERE id = ?`,
      [jam_mulai, jam_selesai, kegiatan, tempat, keterangan || null, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Jadwal alumni berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// DELETE: Hapus jadwal alumni (admin/staff only)
export async function DELETE(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM jadwal_alumni WHERE id = ?', [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Jadwal alumni berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
