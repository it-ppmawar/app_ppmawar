import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { verifyToken } from '@/lib/auth/jwt';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

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
    const { type, id, ids } = body; 
    const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);

    if (!type || targetIds.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    let successCount = 0;
    let lastUsername = '';
    let lastPassword = '';

    for (const currentId of targetIds) {
      if (type === 'guru') {
        const [guruRows] = await pool.execute<RowDataPacket[]>('SELECT * FROM guru WHERE guru_id = ?', [currentId]);
        if (guruRows.length === 0) continue;
        const guru = guruRows[0];

        const username = guru.nip ? guru.nip : `guru${guru.guru_id}`;
        const plainPassword = guru.nip ? guru.nip : '123456';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        let userId = guru.user_id;
        if (!userId) {
          const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [username]);
          if (existing.length > 0) userId = existing[0].id;
        }

        if (userId) {
          await pool.execute(
            'UPDATE users SET username = ?, password = ?, role = ?, nama = ?, nip = ? WHERE id = ?',
            [username, hashedPassword, 'guru', guru.nama, guru.nip, userId]
          );
          await pool.execute('UPDATE guru SET user_id = ? WHERE guru_id = ?', [userId, guru.guru_id]);
        } else {
          const [result] = await pool.execute<ResultSetHeader>(
            'INSERT INTO users (username, password, role, nama, nip) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, 'guru', guru.nama, guru.nip]
          );
          userId = result.insertId;
          await pool.execute('UPDATE guru SET user_id = ? WHERE guru_id = ?', [userId, guru.guru_id]);
        }
        successCount++;
        lastUsername = username;
        lastPassword = plainPassword;
      } else if (type === 'murid') {
        const [muridRows] = await pool.execute<RowDataPacket[]>('SELECT * FROM murid WHERE murid_id = ?', [currentId]);
        if (muridRows.length === 0) continue;
        const murid = muridRows[0];

        const username = `2026${murid.murid_id}`;
        const plainPassword = murid.nis ? murid.nis : '123456';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const namaWali = murid.nama_wali || `Wali dari ${murid.nama}`;

        const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE murid_id = ? OR username = ?', [murid.murid_id, username]);
        
        if (existing.length > 0) {
          const userId = existing[0].id;
          await pool.execute(
            'UPDATE users SET username = ?, password = ?, role = ?, nama = ?, murid_id = ? WHERE id = ?',
            [username, hashedPassword, 'wali_murid', namaWali, murid.murid_id, userId]
          );
        } else {
          await pool.execute(
            'INSERT INTO users (username, password, role, nama, murid_id) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, 'wali_murid', namaWali, murid.murid_id]
          );
        }
        successCount++;
        lastUsername = username;
        lastPassword = plainPassword;
      }
    }

    if (successCount === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang berhasil dikonversi' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil konversi/update ${successCount} User`,
      username: targetIds.length === 1 ? lastUsername : undefined,
      defaultPassword: targetIds.length === 1 ? lastPassword : undefined
    });

  } catch (error: any) {
    console.error('Error konversi user:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
