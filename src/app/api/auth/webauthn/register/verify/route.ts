import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { rpID, origin } from '@/lib/auth/webauthn';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload: any = verifyToken(token);
    if (!payload || !payload.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const expectedChallenge = cookieStore.get('webauthn_challenge')?.value;
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge expired or missing' }, { status: 400 });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
      const { id, publicKey, counter } = credential;
      
      // Clear challenge
      cookieStore.delete('webauthn_challenge');

      // Convert to base64 for storage
      const credIDBase64 = id; // id is already base64url string in v13
      const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
      const transports = body.response.transports ? body.response.transports.join(',') : '';

      // Save to database
      await pool.execute(
        `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)`,
        [payload.userId, credIDBase64, publicKeyBase64, counter, transports]
      );

      return NextResponse.json({ success: true, verified: true });
    }

    return NextResponse.json({ error: 'Not verified' }, { status: 400 });
  } catch (error: any) {
    console.error('Register Verify Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
