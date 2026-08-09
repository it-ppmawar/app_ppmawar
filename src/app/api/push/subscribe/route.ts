import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { endpoint, p256dh, auth } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Data subscription tidak lengkap' }, { status: 400 });
    }

    // Simpan atau update subscription
    await pool.execute(
      `INSERT INTO push_subscriptions (user_id, user_role, user_nama, endpoint, p256dh, auth_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         p256dh = VALUES(p256dh),
         auth_key = VALUES(auth_key),
         updated_at = CURRENT_TIMESTAMP`,
      [
        payload.userId,
        payload.role,
        payload.username || '',
        endpoint,
        p256dh,
        auth,
      ]
    );

    return NextResponse.json({ success: true, message: 'Subscription tersimpan' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint tidak diberikan' }, { status: 400 });
    }

    await pool.execute(
      `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`,
      [payload.userId, endpoint]
    );

    return NextResponse.json({ success: true, message: 'Subscription dihapus' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
