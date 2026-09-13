import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // === Mode Tamu (Guest Login) ===
    if (body.guest === true) {
      const payload = {
        userId: 0,
        username: 'Tamu',
        role: 'tamu',
        guruId: null,
        muridId: null,
        kamarId: null,
        namaAsrama: null
      };
      const token = signToken(payload);
      const response = NextResponse.json({ success: true, message: 'Masuk sebagai tamu', user: payload });
      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 2 // 2 jam untuk tamu
      });
      return response;
    }

    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan Password wajib diisi' }, { status: 400 });
    }

    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*, k.nama_asrama 
       FROM users u 
       LEFT JOIN kamar k ON u.kamar_id = k.kamar_id 
       WHERE u.username = ? LIMIT 1`,
      [username]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'Username tidak ditemukan' }, { status: 401 });
    }

    const user = users[0];

    // Cek password (mendukung legacy plain-text password jika guru_id dikonversi)
    const isHashed = user.password.length > 20; // Asumsi hash bcrypt > 20 chars
    let validPassword = false;

    if (isHashed) {
      validPassword = await bcrypt.compare(password, user.password);
    } else {
      validPassword = password === user.password;
    }

    if (!validPassword) {
      return NextResponse.json({ error: 'Password salah' }, { status: 401 });
    }

    // Ambil guru_id jika rolenya guru (dan auto-link fallback)
    let guruId = null;
    if (user.role === 'guru') {
      const [gurus] = await pool.execute<RowDataPacket[]>(
        'SELECT guru_id FROM guru WHERE user_id = ? LIMIT 1',
        [user.id]
      );
      
      if (gurus.length > 0) {
        guruId = gurus[0].guru_id;
      } else {
        // Auto-link fallback: in legacy DB, users.id matches guru.guru_id directly
        // OR username is '2026' + guru_id
        const possibleGuruId = username.startsWith('2026') ? username.replace('2026', '') : user.id;
        
        const [fallback] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE guru_id = ? OR nip = ? LIMIT 1',
          [possibleGuruId, username]
        );
        if (fallback.length > 0) {
          guruId = fallback[0].guru_id;
          // Perbaiki linkage secara permanen
          await pool.execute('UPDATE guru SET user_id = ? WHERE guru_id = ?', [user.id, guruId]);
        }
      }
    }

    // Auto-repair role for petugas accounts if DB role is empty or invalid
    let userRole = user.role;
    const uname = (user.username || '').toLowerCase();
    const rname = (user.nama || '').toLowerCase();

    if (uname.includes('pengasuh') || rname.includes('pengasuh')) {
      userRole = 'pengasuh';
      pool.execute("UPDATE users SET role = 'pengasuh', is_pengasuh = 1 WHERE id = ?", [user.id]).catch(() => {});
    } else if (uname.includes('pengurus') || rname.includes('pengurus')) {
      userRole = 'pengurus_asrama';
      pool.execute("UPDATE users SET role = 'pengurus_asrama', is_pengurus_asrama = 1 WHERE id = ?", [user.id]).catch(() => {});
    } else if (uname.includes('petugas_inventaris') || rname.includes('petugas inventaris')) {
      if (!userRole || userRole === 'petugas') {
        userRole = (user.asrama || uname.includes('asrama')) ? 'petugas_inventaris' : 'petugas_inventaris_umum';
        pool.execute("UPDATE users SET role = ? WHERE id = ?", [userRole, user.id]).catch(() => {});
      }
    } else if (uname.includes('petugas_kebersihan') || rname.includes('petugas kebersihan')) {
      if (!userRole || userRole === 'petugas') {
        userRole = (user.asrama || uname.includes('asrama')) ? 'petugas_kebersihan' : 'petugas_kebersihan_umum';
        pool.execute("UPDATE users SET role = ? WHERE id = ?", [userRole, user.id]).catch(() => {});
      }
    } else if (uname.includes('petugas_umum') || rname.includes('petugas umum')) {
      if (!userRole || userRole === 'petugas') {
        userRole = 'petugas_umum';
        pool.execute("UPDATE users SET role = 'petugas_umum' WHERE id = ?", [user.id]).catch(() => {});
      }
    } else if ((uname.includes('petugas') || rname.includes('petugas')) && !userRole.toLowerCase().includes('petugas')) {
      userRole = 'petugas_umum';
      pool.execute("UPDATE users SET role = 'petugas_umum' WHERE id = ?", [user.id]).catch(() => {});
    }

    // Buat JWT Token
    const payload = {
      userId: user.id,
      username: user.username,
      role: userRole,
      guruId: guruId,
      muridId: user.murid_id,
      kamarId: user.kamar_id,
      namaAsrama: user.nama_asrama || null,
      asrama: user.asrama || user.nama_asrama || null,
      isPengasuh: !!user.is_pengasuh,
      isPengurusAsrama: !!user.is_pengurus_asrama
    };

    const token = signToken(payload);

    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil',
      user: payload
    });

    // Set HTTP-Only Cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 1 hari
    });

    // Catat aksi login ke audit log
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '';
    logAudit({
      userId: payload.userId,
      userNama: user.nama || payload.username,
      userRole: userRole,
      aksi: 'login',
      tabel: 'users',
      recordId: payload.userId,
      keterangan: `Login berhasil sebagai ${userRole} (username: ${payload.username})`,
      ipAddress,
    }).catch(() => {});

    return response;

  } catch (error: any) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server: ' + (error?.message || String(error)) }, { status: 500 });
  }
}
