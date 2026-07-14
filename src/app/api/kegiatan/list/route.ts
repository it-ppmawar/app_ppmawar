import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await db.query<RowDataPacket[]>('SELECT DISTINCT nama_kegiatan FROM jadwal_kegiatan ORDER BY nama_kegiatan ASC');
    const kegiatan = rows.map(r => r.nama_kegiatan);
    return NextResponse.json({ success: true, kegiatan });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
