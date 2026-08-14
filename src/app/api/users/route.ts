import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import bcrypt from 'bcryptjs';

import { ensureUserColumns } from '@/lib/ensureColumns';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || ((payload as any).role !== 'admin' && (payload as any).role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Auto-migrate missing columns if needed
    await ensureUserColumns();

    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role'); // 'pengelola', 'guru', 'wali_murid'

    let query = `
      SELECT users.id, users.username, users.role, users.nama, users.nip, users.murid_id, users.kamar_id, kamar.nama_kamar,
             users.is_pengasuh, users.is_pengurus_asrama, users.asrama,
             (SELECT COUNT(*) FROM webauthn_credentials wc WHERE wc.user_id = users.id) as has_fingerprint
      FROM users 
      LEFT JOIN kamar ON users.kamar_id = kamar.kamar_id
    `;
    let params: any[] = [];

    if (roleFilter === 'pengelola') {
      query += " WHERE role IN ('admin', 'staff')";
    } else if (roleFilter === 'guru') {
      query += " WHERE role = 'guru'";
    } else if (roleFilter === 'wali_murid') {
      query += " WHERE role = 'wali_murid'";
    } else if (roleFilter === 'pengurus_asrama') {
      query += " WHERE role LIKE '%asrama%'";
    } else if (roleFilter === 'pengasuh') {
      query += " WHERE role = 'pengasuh'";
    } else if (roleFilter === 'petugas') {
      query += " WHERE role LIKE 'petugas%'";
    } else if (roleFilter === 'petugas_panggilan') {
      query += " WHERE role LIKE '%petugas_panggilan%'";
    } else if (roleFilter === 'wali_alumni') {
      query += " WHERE role = 'wali_alumni'";
    }

    let rows: RowDataPacket[] = [];
    try {
      const [res] = await pool.execute<RowDataPacket[]>(query, params);
      rows = res;
    } catch (queryErr: any) {
      // Safe fallback if column is missing despite migration
      const fallbackQuery = query.replace('users.is_pengasuh, users.is_pengurus_asrama, users.asrama,', '');
      const [res] = await pool.execute<RowDataPacket[]>(fallbackQuery, params);
      rows = res.map((r: any) => ({ ...r, is_pengasuh: 0, is_pengurus_asrama: 0, asrama: null }));
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Admin Utama yang dapat menambah user' }, { status: 403 });
    }

    await ensureUserColumns();

    const body = await request.json();
    const { username, password, role, nama, nip, kamar_id, is_pengasuh, is_pengurus_asrama, asrama } = body;

    if (!username || !password || !role || !nama) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return NextResponse.json({ error: 'Username sudah terdaftar' }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 10);
    const isPengasuhVal = (role === 'pengasuh' || is_pengasuh) ? 1 : 0;
    const isPengurusVal = (role === 'pengurus_asrama' || is_pengurus_asrama) ? 1 : 0;
    await pool.execute(
      'INSERT INTO users (username, password, role, nama, nip, kamar_id, is_pengasuh, is_pengurus_asrama, asrama) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, role, nama, nip || null, kamar_id || null, isPengasuhVal, isPengurusVal, asrama || null]
    );

    return NextResponse.json({ success: true, message: 'User berhasil ditambahkan' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Admin Utama yang dapat mengedit user' }, { status: 403 });
    }

    const body = await request.json();
    const { id, username, password, role, nama, nip, kamar_id, reset_fingerprint, is_pengasuh, is_pengurus_asrama, asrama } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    // Biometric reset action
    if (reset_fingerprint) {
      await pool.execute('DELETE FROM webauthn_credentials WHERE user_id = ?', [id]);
      return NextResponse.json({ success: true, message: 'Sidik jari/Biometrik berhasil direset' });
    }

    if (!username || !role || !nama) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Check duplicate username
    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
    if (existing.length > 0) return NextResponse.json({ error: 'Username sudah digunakan oleh user lain' }, { status: 400 });

    const isPengasuhVal = (role === 'pengasuh' || is_pengasuh) ? 1 : 0;
    const isPengurusVal = (role === 'pengurus_asrama' || is_pengurus_asrama) ? 1 : 0;
    let query = 'UPDATE users SET username = ?, role = ?, nama = ?, nip = ?, kamar_id = ?, is_pengasuh = ?, is_pengurus_asrama = ?, asrama = ?';
    let params: any[] = [username, role, nama, nip || null, kamar_id || null, isPengasuhVal, isPengurusVal, asrama || null];

    if (password) {
      query += ', password = ?';
      const hashedPassword = await bcrypt.hash(password, 10);
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.execute(query, params);

    return NextResponse.json({ success: true, message: 'User berhasil diperbarui' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Admin Utama yang dapat menghapus user' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    if (id === payload.id) {
      return NextResponse.json({ error: 'Anda tidak dapat menghapus akun Anda sendiri' }, { status: 400 });
    }

    // Detach from guru or murid before deleting to avoid constraint errors if not using cascade
    await pool.execute('UPDATE guru SET user_id = NULL WHERE user_id = ?', [id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
