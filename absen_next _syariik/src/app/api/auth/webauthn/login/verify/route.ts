import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { rpID, origin } from '@/lib/auth/webauthn';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { signToken } from '@/lib/auth/jwt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('webauthn_auth_challenge')?.value;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge expired or missing' }, { status: 400 });
    }

    // Cari credential di DB
    const [creds] = await pool.execute<RowDataPacket[]>(
      'SELECT wc.*, u.username, u.role, u.murid_id, u.kamar_id, k.nama_asrama FROM webauthn_credentials wc JOIN users u ON wc.user_id = u.id LEFT JOIN kamar k ON u.kamar_id = k.kamar_id WHERE wc.credential_id = ? LIMIT 1',
      [body.id]
    );

    if (creds.length === 0) {
      return NextResponse.json({ error: 'Credential tidak ditemukan atau belum terdaftar.' }, { status: 404 });
    }

    const authenticator = creds[0];
    
    if (authenticator.role !== 'guru' && authenticator.role !== 'wali_murid') {
      return NextResponse.json({ error: 'Login biometrik hanya diizinkan untuk Guru dan Wali Murid.' }, { status: 403 });
    }

    const publicKeyBytes = Buffer.from(authenticator.public_key, 'base64');

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: authenticator.credential_id, // string
          publicKey: publicKeyBytes, // Uint8Array
          counter: authenticator.counter, // number
          transports: authenticator.transports ? authenticator.transports.split(',') : undefined,
        },
      });
    } catch (error: any) {
      console.error('Verify error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      // Update counter
      await pool.execute('UPDATE webauthn_credentials SET counter = ? WHERE id = ?', [authenticationInfo.newCounter, authenticator.id]);
      cookieStore.delete('webauthn_auth_challenge');

      // Ambil guru_id jika rolenya guru
      let guruId = null;
      if (authenticator.role === 'guru') {
        const [gurus] = await pool.execute<RowDataPacket[]>('SELECT guru_id FROM guru WHERE user_id = ? LIMIT 1', [authenticator.user_id]);
        if (gurus.length > 0) guruId = gurus[0].guru_id;
      }

      // Buat JWT Token (sama seperti login biasa)
      const payload = {
        userId: authenticator.user_id,
        username: authenticator.username,
        role: authenticator.role,
        guruId: guruId,
        muridId: authenticator.murid_id,
        kamarId: authenticator.kamar_id,
        namaAsrama: authenticator.nama_asrama || null
      };

      const token = signToken(payload);

      const response = NextResponse.json({
        success: true,
        message: 'Login sidik jari berhasil',
        user: payload
      });

      response.cookies.set('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 // 1 hari
      });

      return response;
    }

    return NextResponse.json({ error: 'Verifikasi gagal' }, { status: 400 });
  } catch (error: any) {
    console.error('Login Verify Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
