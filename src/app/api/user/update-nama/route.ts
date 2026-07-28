import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

// PATCH /api/user/update-nama — update nama user yang login
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const userId = payload.userId || payload.id;
    if (!userId) return NextResponse.json({ error: 'User ID tidak ditemukan' }, { status: 400 });

    const body = await request.json();
    const { nama } = body;

    if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
      return NextResponse.json({ error: 'Nama tidak valid (minimal 2 karakter)' }, { status: 400 });
    }

    // Update nama di tabel users
    await pool.execute(
      'UPDATE users SET nama = ? WHERE id = ?',
      [nama.trim(), userId]
    );

    return NextResponse.json({ success: true, message: 'Nama berhasil diperbarui', nama: nama.trim() });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
