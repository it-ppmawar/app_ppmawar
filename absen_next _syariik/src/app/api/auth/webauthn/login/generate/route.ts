import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { rpID } from '@/lib/auth/webauthn';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    let allowCredentials = undefined;

    // Jika username diberikan, kita bisa membatasi kredensial hanya untuk user tersebut
    if (username) {
      const [users] = await pool.execute<RowDataPacket[]>('SELECT id, role FROM users WHERE username = ? LIMIT 1', [username]);
      if (users.length > 0) {
        const user = users[0];
        if (user.role !== 'guru' && user.role !== 'wali_murid') {
          return NextResponse.json({ error: 'Login biometrik hanya diizinkan untuk Guru dan Wali Murid.' }, { status: 403 });
        }
        const [creds] = await pool.execute<RowDataPacket[]>('SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?', [user.id]);
        if (creds.length > 0) {
          allowCredentials = creds.map(c => ({
            id: c.credential_id, // base64url expected
            type: 'public-key' as const,
            transports: c.transports ? c.transports.split(',') as any[] : undefined,
          }));
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    const cookieStore = await cookies();
    cookieStore.set('webauthn_auth_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 5 // 5 menit
    });

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('Login Generate Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
