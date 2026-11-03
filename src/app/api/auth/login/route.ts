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

    const cleanUsername = (username || '').toString().trim();
    const cleanPassword = (password || '').toString().trim();

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json({ error: 'Username dan Password wajib diisi' }, { status: 400 });
    }

    // 1. Cari user di tabel users (langsung via username, atau via relasi murid untuk wali_murid)
    let [users] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*, k.nama_asrama, m.nis as santri_nis, m.nama as santri_nama, m.murid_id as santri_id
       FROM users u 
       LEFT JOIN kamar k ON u.kamar_id = k.kamar_id 
       LEFT JOIN murid m ON u.murid_id = m.murid_id
       WHERE u.username = ? 
          OR (u.role = 'wali_murid' AND (
               m.nis = ? 
            OR CONCAT('2026', m.murid_id) = ? 
            OR LOWER(TRIM(m.nama)) = LOWER(?)
          ))
       LIMIT 1`,
      [cleanUsername, cleanUsername, cleanUsername, cleanUsername]
    );

    // 2. Jika belum ditemukan di tabel users, periksa apakah username cocok dengan data santri di tabel murid
    // (Auto-provision akun wali murid jika santri terdaftar tetapi belum dibuatkan record di tabel users)
    if (users.length === 0) {
      const [muridRows] = await pool.execute<RowDataPacket[]>(
        `SELECT murid_id, nis, nama, nama_wali FROM murid 
         WHERE nis = ? 
            OR CONCAT('2026', murid_id) = ? 
            OR LOWER(TRIM(nama)) = LOWER(?)
         LIMIT 1`,
        [cleanUsername, cleanUsername, cleanUsername]
      );

      if (muridRows.length > 0) {
        const m = muridRows[0];
        const defaultNis = (m.nis || '').trim();
        const defaultLegacy = `2026${m.murid_id}`;
        
        // Cek apakah password yang dimasukkan cocok dengan NIS atau 2026+murid_id
        if ((defaultNis && cleanPassword === defaultNis) || cleanPassword === defaultLegacy) {
          const userUname = defaultNis || defaultLegacy;
          const hashed = await bcrypt.hash(cleanPassword, 10);
          const namaWali = m.nama_wali || `Wali dari ${m.nama}`;
          
          // Buat akun wali murid baru secara otomatis
          const [ins] = await pool.execute<any>(
            `INSERT INTO users (username, password, role, nama, murid_id) VALUES (?, ?, 'wali_murid', ?, ?)`,
            [userUname, hashed, namaWali, m.murid_id]
          );
          
          const [newUsers] = await pool.execute<RowDataPacket[]>(
            `SELECT u.*, NULL as nama_asrama, ? as santri_nis, ? as santri_nama, ? as santri_id
             FROM users u WHERE u.id = ? LIMIT 1`,
            [m.nis, m.nama, m.murid_id, ins.insertId]
          );
          if (newUsers.length > 0) {
            users = newUsers;
          }
        }
      }
    }

    if (users.length === 0) {
      return NextResponse.json({ error: 'Username tidak ditemukan' }, { status: 401 });
    }

    const user = users[0];

    // Cek password (mendukung legacy plain-text password jika guru_id dikonversi)
    const isHashed = user.password && user.password.length > 20; // Asumsi hash bcrypt > 20 chars
    let validPassword = false;

    if (isHashed) {
      validPassword = await bcrypt.compare(cleanPassword, user.password);
    } else {
      validPassword = cleanPassword === user.password;
    }

    // Fallback fleksibel untuk Wali Murid:
    // Izinkan login jika password cocok dengan NIS santri atau 2026+murid_id default
    if (!validPassword && (user.role === 'wali_murid' || user.murid_id)) {
      const defaultNis = (user.santri_nis || '').trim();
      const defaultLegacy = user.santri_id ? `2026${user.santri_id}` : '';
      if ((defaultNis && cleanPassword === defaultNis) || (defaultLegacy && cleanPassword === defaultLegacy)) {
        validPassword = true;
        // Auto-heal password di DB agar tersimpan hash terbarunya
        bcrypt.hash(cleanPassword, 10).then(hashed => {
          pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]).catch(() => {});
        }).catch(() => {});
      }
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
