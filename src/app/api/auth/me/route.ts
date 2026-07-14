import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

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

    // Check if user has fingerprint registered
    let hasFingerprint = false;
    if (payload.userId) {
      const [creds] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM webauthn_credentials WHERE user_id = ? LIMIT 1',
        [payload.userId]
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
      } else if (payload.userId) {
        const [users] = await pool.execute<RowDataPacket[]>(
          'SELECT nama FROM users WHERE id = ? LIMIT 1',
          [payload.userId]
        );
        if (users.length > 0 && users[0].nama) {
          realName = users[0].nama;
        }
      }
    } catch (nameErr) {
      // Non-fatal: fall back to username if real_name query fails
      console.warn('[auth/me] Could not fetch real_name:', nameErr);
    }

    return NextResponse.json({
      success: true,
      user: { ...payload, real_name: realName, has_fingerprint: hasFingerprint }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
