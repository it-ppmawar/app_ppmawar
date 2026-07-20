import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const results: string[] = [];

  // 1. Add is_pengasuh to users
  try {
    await pool.execute(
      'ALTER TABLE users ADD COLUMN is_pengasuh TINYINT(1) NOT NULL DEFAULT 0'
    );
    results.push('✅ Kolom is_pengasuh berhasil ditambahkan ke tabel users');
  } catch (e: any) {
    if (e.message?.includes('Duplicate column')) {
      results.push('ℹ️ Kolom is_pengasuh sudah ada di tabel users (tidak perlu ditambah)');
    } else {
      results.push('❌ Gagal menambah is_pengasuh: ' + e.message);
    }
  }

  // 2. Verify column exists
  try {
    const [rows]: any = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'is_pengasuh' AND TABLE_SCHEMA = DATABASE()"
    );
    if (rows.length > 0) {
      results.push('✅ Verifikasi: kolom is_pengasuh TERKONFIRMASI ada di tabel users');
    } else {
      results.push('❌ Verifikasi: kolom is_pengasuh TIDAK DITEMUKAN di tabel users — ada masalah!');
    }
  } catch (e: any) {
    results.push('⚠️ Verifikasi gagal: ' + e.message);
  }

  return NextResponse.json({ success: true, results });
}
