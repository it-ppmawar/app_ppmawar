import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload;
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan LIKE 'wa_template_%'"
    );

    const templates: Record<string, string> = {};
    rows.forEach((row) => {
      templates[row.nama_pengaturan] = row.nilai;
    });

    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    console.error('Error fetching message templates:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { key, value, templates, action } = body;

    if (action === 'reset' && key && key.startsWith('wa_template_')) {
      await pool.execute(
        'DELETE FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = ?',
        [key]
      );
      return NextResponse.json({ success: true, message: `Templat ${key} telah di-reset ke default` });
    }

    if (templates && typeof templates === 'object') {
      for (const [k, v] of Object.entries(templates)) {
        if (k.startsWith('wa_template_')) {
          await pool.execute(
            'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
            [k, String(v), String(v)]
          );
        }
      }
      return NextResponse.json({ success: true, message: 'Semua templat berhasil disimpan' });
    }

    if (key && key.startsWith('wa_template_') && value !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        [key, String(value), String(value)]
      );
      return NextResponse.json({ success: true, message: `Templat ${key} berhasil disimpan` });
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  } catch (error: any) {
    console.error('Error saving message template:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
