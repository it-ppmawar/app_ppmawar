import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [kamars] = await pool.execute<RowDataPacket[]>('SELECT * FROM kamar');
    let createdCount = 0;

    for (const kamar of kamars) {
      const username = `pengurus_${kamar.nama_kamar.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const passwordHash = await bcrypt.hash('asrama123', 10);
      const namaLengkap = `Pengurus ${kamar.nama_kamar}`;

      try {
        await pool.execute(
          'INSERT INTO users (username, password, role, nama_lengkap, kamar_id) VALUES (?, ?, ?, ?, ?)',
          [username, passwordHash, 'pengurus_asrama', namaLengkap, kamar.kamar_id]
        );
        createdCount++;
      } catch (e: any) {
        // Abaikan jika akun sudah ada (Duplicate entry)
        if (e.code !== 'ER_DUP_ENTRY') {
          console.error(`Gagal membuat akun ${username}:`, e.message);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil men-generate ${createdCount} akun pengurus asrama. Password default: asrama123` 
    });
  } catch (error: any) {
    console.error('Error API generate-pengurus:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
