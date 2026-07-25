import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

import { ensureUserColumns } from '@/lib/ensureColumns';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: any = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401 });
    }

    const userId = payload.userId || payload.id;

    // Check if user has fingerprint registered
    let hasFingerprint = false;
    if (userId) {
      const [creds] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM webauthn_credentials WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (creds.length > 0) hasFingerprint = true;
    }

    // Retrieve real name — wrapped in separate try-catch so failure is non-fatal
    let realName = payload.username;
    try {
      if (payload.role === 'guru' && payload.guruId) {
        const [gurus] = await pool.execute<RowDataPacket[]>(
          'SELECT nama FROM guru WHERE guru_id = ? LIMIT 1',
          [payload.guruId]
        );
        if (gurus.length > 0) {
          realName = gurus[0].nama;
        }
      } else if (payload.role === 'wali_murid' && payload.muridId) {
        // Khusus wali murid: ambil nama_wali dari tabel murid
        const [murids] = await pool.execute<RowDataPacket[]>(
          'SELECT nama_wali, nama FROM murid WHERE murid_id = ? LIMIT 1',
          [payload.muridId]
        );
        if (murids.length > 0) {
          realName = murids[0].nama_wali || ('Wali dari ' + murids[0].nama) || payload.username;
        }
      } else if (userId) {
        const [users] = await pool.execute<RowDataPacket[]>(
          'SELECT nama FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
        if (users.length > 0 && users[0].nama) {
          realName = users[0].nama;
        }
      }
    } catch (nameErr) {
      // Non-fatal: fall back to username if real_name query fails
      console.warn('[auth/me] Could not fetch real_name:', nameErr);
    }

    // Fetch double-role flags, fresh role, and asrama from DB (to ensure up-to-date even if token is old)
    const roleStr = (payload.role || '').toLowerCase();
    let currentRole = payload.role;
    let isPengasuh = !!(payload.isPengasuh || roleStr.includes('pengasuh'));
    let isPengurusAsrama = !!(payload.isPengurusAsrama || roleStr.includes('pengurus'));
    let asramaVal = payload.asrama || payload.namaAsrama || null;
    try {
      if (userId) {
        await ensureUserColumns();
        const [uRows] = await pool.execute<RowDataPacket[]>('SELECT username, nama, role, is_pengasuh, is_pengurus_asrama, asrama FROM users WHERE id = ? LIMIT 1', [userId]);
        if (uRows.length > 0) {
          let dbRole = uRows[0].role || currentRole || '';
          const uname = (uRows[0].username || payload.username || '').toLowerCase();
          const rname = (uRows[0].nama || realName || '').toLowerCase();

          if (uname.includes('petugas_inventaris') || rname.includes('petugas inventaris')) {
            dbRole = 'petugas_inventaris_umum';
            pool.execute("UPDATE users SET role = 'petugas_inventaris_umum' WHERE id = ?", [userId]).catch(() => {});
          } else if (uname.includes('petugas_kebersihan') || rname.includes('petugas kebersihan')) {
            dbRole = 'petugas_kebersihan_umum';
            pool.execute("UPDATE users SET role = 'petugas_kebersihan_umum' WHERE id = ?", [userId]).catch(() => {});
          } else if (uname.includes('petugas_umum') || rname.includes('petugas umum')) {
            dbRole = 'petugas_umum';
            pool.execute("UPDATE users SET role = 'petugas_umum' WHERE id = ?", [userId]).catch(() => {});
          } else if ((uname.includes('petugas') || rname.includes('petugas')) && !dbRole.toLowerCase().includes('petugas')) {
            dbRole = 'petugas_umum';
            pool.execute("UPDATE users SET role = 'petugas_umum' WHERE id = ?", [userId]).catch(() => {});
          }

          currentRole = dbRole;
          const roleLower = (dbRole || '').toLowerCase();
          isPengasuh = !!(uRows[0].is_pengasuh || roleLower.includes('pengasuh'));
          isPengurusAsrama = !!(uRows[0].is_pengurus_asrama || roleLower.includes('pengurus'));
          if (uRows[0].asrama) asramaVal = uRows[0].asrama;
        }
      }
    } catch (e) {}

    return NextResponse.json({
      success: true,
      user: { 
        ...payload, 
        role: currentRole,
        real_name: realName, 
        has_fingerprint: hasFingerprint, 
        is_pengasuh: isPengasuh,
        isPengasuh: isPengasuh,
        is_pengurus_asrama: isPengurusAsrama,
        isPengurusAsrama: isPengurusAsrama,
        asrama: asramaVal
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
