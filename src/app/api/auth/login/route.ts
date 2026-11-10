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

    // =========================================================================
    // 1. CEK KHUSUS DEWAN GURU & STAFF:
    // Format akun default Guru:
    // - Jika tanpa NIP : '2026' + guru_id (contoh: 2026130 untuk guru_id 130)
    // - Jika dengan NIP: '2026' + NIP atau NIP langsung
    // =========================================================================
    let users: RowDataPacket[] = [];
    let matchingGuru: any = null;

    if (cleanUsername.startsWith('2026')) {
      const candidateId = cleanUsername.slice(4);
      if (/^\d+$/.test(candidateId)) {
        const [guruRows] = await pool.execute<RowDataPacket[]>(
          'SELECT * FROM guru WHERE guru_id = ? OR nip = ? OR nip = ? OR CONCAT("2026", nip) = ? LIMIT 1',
          [candidateId, candidateId, cleanUsername, cleanUsername]
        );
        if (guruRows.length > 0) {
          matchingGuru = guruRows[0];
        }
      }
    } else {
      // Cek apakah username adalah NIP guru
      const [guruRows] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM guru WHERE nip = ? OR CONCAT("2026", nip) = ? LIMIT 1',
        [cleanUsername, cleanUsername]
      );
      if (guruRows.length > 0) {
        matchingGuru = guruRows[0];
      }
    }

    if (matchingGuru) {
      // Cari akun user untuk guru ini di tabel users
      const [guruUsers] = await pool.execute<RowDataPacket[]>(
        `SELECT u.*, NULL as nama_asrama, NULL as santri_nis, NULL as santri_nama, NULL as santri_id
         FROM users u
         WHERE (u.id = ? OR u.username = ? OR (u.role = 'guru' AND u.nip = ?)) AND u.role != 'wali_murid'
         LIMIT 1`,
        [matchingGuru.user_id || 0, cleanUsername, matchingGuru.nip || '---']
      );

      if (guruUsers.length > 0) {
        users = guruUsers;
      } else {
        // Antisipasi: jika username '2026...' sempat terbuat sebagai wali_murid karena bentrok ID santri,
        // pulihkan username wali_murid tersebut ke NIS resmi santrinya agar kredensial guru bersih
        const [conflictedUsers] = await pool.execute<RowDataPacket[]>(
          `SELECT u.*, m.nis FROM users u LEFT JOIN murid m ON u.murid_id = m.murid_id WHERE u.username = ? AND u.role = 'wali_murid' LIMIT 1`,
          [cleanUsername]
        );

        if (conflictedUsers.length > 0) {
          const conf = conflictedUsers[0];
          const realNis = conf.nis || `wali_${conf.murid_id}`;
          await pool.execute('UPDATE users SET username = ? WHERE id = ?', [realNis, conf.id]);
        }

        // Auto-provision akun guru jika kredensial default cocok
        const defaultPassword = cleanUsername;
        const altDefaultPassword = (matchingGuru.nip && matchingGuru.nip.trim() !== '') ? `2026${matchingGuru.nip.trim()}` : `2026${matchingGuru.guru_id}`;
        if (cleanPassword === defaultPassword || cleanPassword === altDefaultPassword) {
          const hashed = await bcrypt.hash(cleanPassword, 10);
          const [ins] = await pool.execute<any>(
            `INSERT INTO users (username, password, role, nama, nip) VALUES (?, ?, 'guru', ?, ?)`,
            [cleanUsername, hashed, matchingGuru.nama, matchingGuru.nip || null]
          );
          const newUserId = ins.insertId;
          await pool.execute('UPDATE guru SET user_id = ? WHERE guru_id = ?', [newUserId, matchingGuru.guru_id]);
          
          const [createdUsers] = await pool.execute<RowDataPacket[]>(
            `SELECT u.*, NULL as nama_asrama, NULL as santri_nis, NULL as santri_nama, NULL as santri_id FROM users u WHERE u.id = ? LIMIT 1`,
            [newUserId]
          );
          users = createdUsers;
        }
      }
    }

    // =========================================================================
    // 2. CEK USER REGULER (ADMIN, STAFF, PENGASUH, PENGURUS, WALI MURID VIA NIS)
    // =========================================================================
    if (users.length === 0) {
      const [exactUsers] = await pool.execute<RowDataPacket[]>(
        `SELECT u.*, k.nama_asrama, m.nis as santri_nis, m.nama as santri_nama, m.murid_id as santri_id
         FROM users u 
         LEFT JOIN kamar k ON u.kamar_id = k.kamar_id 
         LEFT JOIN murid m ON u.murid_id = m.murid_id
         WHERE u.username = ?
         ORDER BY (CASE WHEN u.role != 'wali_murid' THEN 0 ELSE 1 END) ASC
         LIMIT 1`,
        [cleanUsername]
      );

      if (exactUsers.length > 0) {
        users = exactUsers;
      }
    }

    // =========================================================================
    // 3. FALLBACK KHUSUS WALI MURID (VIA NIS SANTRI ATAU NAMA LENGKAP SANTRI)
    // =========================================================================
    if (users.length === 0) {
      const [waliUsers] = await pool.execute<RowDataPacket[]>(
        `SELECT u.*, k.nama_asrama, m.nis as santri_nis, m.nama as santri_nama, m.murid_id as santri_id
         FROM users u 
         LEFT JOIN kamar k ON u.kamar_id = k.kamar_id 
         INNER JOIN murid m ON u.murid_id = m.murid_id
         WHERE u.role = 'wali_murid' AND (
              m.nis = ? 
           OR LOWER(TRIM(m.nama)) = LOWER(?)
         )
         LIMIT 1`,
        [cleanUsername, cleanUsername]
      );

      if (waliUsers.length > 0) {
        users = waliUsers;
      } else {
        // Auto-provision akun wali murid jika data santri terdaftar di tabel murid tetapi belum dibuatkan di users
        const [muridRows] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nis, nama, nama_wali FROM murid 
           WHERE nis = ? 
              OR LOWER(TRIM(nama)) = LOWER(?)
           LIMIT 1`,
          [cleanUsername, cleanUsername]
        );

        if (muridRows.length > 0) {
          const m = muridRows[0];
          const defaultNis = (m.nis || '').trim();
          
          if (defaultNis && cleanPassword === defaultNis) {
            const hashed = await bcrypt.hash(cleanPassword, 10);
            const namaWali = m.nama_wali || `Wali dari ${m.nama}`;
            
            const [ins] = await pool.execute<any>(
              `INSERT INTO users (username, password, role, nama, murid_id) VALUES (?, ?, 'wali_murid', ?, ?)`,
              [defaultNis, hashed, namaWali, m.murid_id]
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
    // Izinkan login jika password cocok dengan NIS santri resmi
    if (!validPassword && (user.role === 'wali_murid' || user.murid_id)) {
      const defaultNis = (user.santri_nis || '').trim();
      if (defaultNis && cleanPassword === defaultNis) {
        validPassword = true;
        // Auto-heal password di DB agar tersimpan hash terbarunya
        bcrypt.hash(cleanPassword, 10).then(hashed => {
          pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]).catch(() => {});
        }).catch(() => {});
      }
    }

    // Fallback fleksibel untuk Guru:
    // Izinkan login jika password cocok dengan username default guru
    if (!validPassword && user.role === 'guru') {
      if (cleanPassword === user.username) {
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
        const unameToCheck = user.username || cleanUsername;
        const possibleGuruId = unameToCheck.startsWith('2026') ? unameToCheck.replace('2026', '') : user.id;
        
        const [fallback] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE guru_id = ? OR nip = ? LIMIT 1',
          [possibleGuruId, unameToCheck]
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
