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

    return NextResponse.json({
      success: true,
      user: { ...payload, has_fingerprint: hasFingerprint }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
