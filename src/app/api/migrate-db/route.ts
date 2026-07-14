import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    let results = [];
    
    // Add kamar_id to users if it doesn't exist
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN kamar_id INT NULL');
      results.push('Added kamar_id to users');
    } catch (e: any) {
      results.push('users.kamar_id already exists or error: ' + e.message);
    }

    // Add barcode_id to murid
    try {
      await pool.execute('ALTER TABLE murid ADD COLUMN barcode_id VARCHAR(100) NULL');
      results.push('Added barcode_id to murid');
    } catch (e: any) {
      results.push('murid.barcode_id already exists or error: ' + e.message);
    }

    // Add barcode_id to guru
    try {
      await pool.execute('ALTER TABLE guru ADD COLUMN barcode_id VARCHAR(100) NULL');
      results.push('Added barcode_id to guru');
    } catch (e: any) {
      results.push('guru.barcode_id already exists or error: ' + e.message);
    }

    // Add kategori_mukim to alumni
    try {
      await pool.execute("ALTER TABLE alumni ADD COLUMN kategori_mukim ENUM('PPM','LPPM') NOT NULL DEFAULT 'PPM'");
      results.push('Added kategori_mukim to alumni');
    } catch (e: any) {
      results.push('alumni.kategori_mukim already exists or error: ' + e.message);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
