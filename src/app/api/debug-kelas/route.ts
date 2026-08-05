import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [madinRows] = await pool.execute<RowDataPacket[]>(
      'SELECT kelas_id, nama_kelas FROM kelas_madin ORDER BY kelas_id ASC LIMIT 20'
    );
    const [quranRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, nama_kelas FROM kelas_quran ORDER BY id ASC LIMIT 20'
    );
    const [muridSample] = await pool.execute<RowDataPacket[]>(
      'SELECT murid_id, nama, kelas_madin_id, kelas_madin_2_id, kelas_quran_id FROM murid LIMIT 10'
    );
    return NextResponse.json({ 
      kelas_madin: madinRows, 
      kelas_quran: quranRows,
      murid_sample: muridSample 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
