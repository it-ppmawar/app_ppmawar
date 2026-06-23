import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

const SECRET_KEY = process.env.JWT_SECRET || 'secret-key-super-aman';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Tidak ada sesi aktif' }, { status: 401 });
    }

    // Decode token
    const decoded: any = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 });
    }

    const userId = decoded.userId;
    const { currentPassword, newUsername, newPassword } = await request.json();

    if (!currentPassword) {
      return NextResponse.json({ error: 'Password saat ini wajib diisi untuk keamanan' }, { status: 400 });
    }

    // Ambil data user saat ini
    const [users] = await pool.execute<RowDataPacket[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const user = users[0];

    // Verifikasi password saat ini
    const isHashed = user.password.length > 20;
    let validPassword = false;
    if (isHashed) {
      validPassword = await bcrypt.compare(currentPassword, user.password);
    } else {
      validPassword = currentPassword === user.password;
    }

    if (!validPassword) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 401 });
    }

    // Cek username baru
    if (newUsername && newUsername !== user.username) {
      const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE username = ? LIMIT 1', [newUsername]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'Username sudah digunakan oleh akun lain' }, { status: 400 });
      }
    }

    // Update query preparation
    let finalUsername = newUsername || user.username;
    let finalPassword = user.password;

    if (newPassword && newPassword.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      finalPassword = await bcrypt.hash(newPassword, salt);
    } else if (newPassword && newPassword.length > 0) {
      return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });
    }

    await pool.execute(
      'UPDATE users SET username = ?, password = ? WHERE id = ?',
      [finalUsername, finalPassword, userId]
    );

    return NextResponse.json({ success: true, message: 'Profil berhasil diperbarui' });
  } catch (error: any) {
    console.error('Update Profile Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}
