import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    let bridgeUrl = 'https://quizb.my.id/quizb_bridge.php';
    let secretKey = 'ppmawar-quizb-2026-secret';

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT setting_key, setting_value FROM quizb_settings WHERE setting_key IN ('bridge_url', 'secret_key')"
    );
    rows.forEach((r: any) => {
      if (r.setting_key === 'bridge_url' && r.setting_value) bridgeUrl = r.setting_value;
      if (r.setting_key === 'secret_key' && r.setting_value) secretKey = r.setting_value;
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ppmawar.or.id';
    const webhookUrl = `${origin}/api/quizb/webhook`;

    return NextResponse.json({
      success: true,
      bridge_url: bridgeUrl,
      secret_key: secretKey,
      webhook_url: webhookUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Admin yang dapat mengubah konfigurasi QuizB.' }, { status: 403 });
    }

    const body = await request.json();
    const { bridge_url, secret_key } = body;

    if (bridge_url) {
      await pool.execute(
        `INSERT INTO quizb_settings (setting_key, setting_value) 
         VALUES ('bridge_url', ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [bridge_url.trim()]
      );
    }

    if (secret_key) {
      await pool.execute(
        `INSERT INTO quizb_settings (setting_key, setting_value) 
         VALUES ('secret_key', ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [secret_key.trim()]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pengaturan integrasi QuizB berhasil disimpan.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
