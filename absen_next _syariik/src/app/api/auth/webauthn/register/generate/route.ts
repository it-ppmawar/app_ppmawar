import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { rpName, rpID } from '@/lib/auth/webauthn';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: any = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Ambil data user
    const [users] = await pool.execute<RowDataPacket[]>('SELECT id, username, nama FROM users WHERE id = ?', [payload.userId]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];

    // Cek existing credentials untuk mengecualikannya (biar ga duplicate register perangkat yg sama)
    const [creds] = await pool.execute<RowDataPacket[]>('SELECT credential_id FROM webauthn_credentials WHERE user_id = ?', [user.id]);
    const excludeCredentials = creds.map(c => ({
      id: c.credential_id,
      type: 'public-key' as const,
      transports: ['internal', 'usb', 'ble', 'nfc'] as any[],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id.toString()),
      userName: user.username,
      userDisplayName: user.nama || user.username,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    // Simpan challenge ke cookie (stateless)
    cookieStore.set('webauthn_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 5 // 5 menit
    });

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('Register Generate Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
