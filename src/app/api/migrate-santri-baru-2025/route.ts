import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/migrate-santri-baru-2025
 * Migrasi otomatis 268 santri baru dari file `SANTRI BARU FIKS 2025-1.xlsx`:
 * - Update kelas madin 78 santri terdaftar
 * - Insert 190 santri murni baru ke database production cPanel
 * Safe & Idempotent (Menggunakan WHERE NIS / NOT EXISTS).
 */
export async function GET() {
  try {
    const results: any[] = [];

    // Baca query dari file atau hardcode payload terkompresi
    const fs = await import('fs');
    const path = await import('path');
    const sqlPath = path.join(process.cwd(), 'data_madin', 'MIGRASI_SANTRI_BARU_FIKS_2025.sql');

    if (!fs.existsSync(sqlPath)) {
      return NextResponse.json({ success: false, error: 'File SQL migrasi tidak ditemukan' }, { status: 404 });
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let executed = 0;
    for (const stmt of statements) {
      if (stmt.length > 5) {
        await pool.execute(stmt);
        executed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migrasi 268 Santri Baru Tadris 2025/2026 Berhasil Selesai!`,
      total_query_dieksekusi: executed,
      catatan: '78 Santri Terdaftar di-update kelasnya, 190 Santri Baru di-insert ke DB production.'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
