import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

// One-time migration endpoint to add restore columns to alumni table
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || (payload as any).role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat menjalankan migrasi' }, { status: 403 });
    }

    const migrations = [
      "ALTER TABLE alumni ADD COLUMN IF NOT EXISTS last_kamar_id INT NULL",
      "ALTER TABLE alumni ADD COLUMN IF NOT EXISTS last_kelas_madin_id INT NULL",
      "ALTER TABLE alumni ADD COLUMN IF NOT EXISTS last_kelas_quran_id INT NULL",
      "ALTER TABLE alumni ADD COLUMN IF NOT EXISTS nama_panggilan VARCHAR(100) NULL",
      "ALTER TABLE alumni ADD COLUMN IF NOT EXISTS barcode_id VARCHAR(100) NULL",
    ];

    const results: string[] = [];

    for (const sql of migrations) {
      try {
        await pool.execute(sql);
        results.push(`✅ ${sql.substring(0, 60)}...`);
      } catch (err: any) {
        // Kolom sudah ada (error 1060) - lanjutkan saja
        if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
          results.push(`⏭️ Kolom sudah ada, dilewati: ${sql.substring(30, 80)}...`);
        } else {
          results.push(`❌ Error: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migrasi database alumni selesai',
      details: results
    });
  } catch (error: any) {
    console.error('Error migration:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
