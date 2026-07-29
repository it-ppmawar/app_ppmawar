import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/kartu-emaal
 * 
 * Membaca file kartu eMaal dari folder public/kartu_emaal/ yang sudah di-deploy,
 * kemudian mempairing NIS (nama file) ke database murid.
 * 
 * CATATAN: File kartu perlu disiapkan terlebih dahulu secara lokal menggunakan:
 *   node scripts/pair-kartu-emaal.js
 * lalu di-push ke Git agar terdeploy ke server.
 */
export async function GET() {
  try {
    // Baca dari public/kartu_emaal/ (folder yang sudah terdeploy ke server)
    const kartuDir = path.join(process.cwd(), 'public', 'kartu_emaal');

    if (!fs.existsSync(kartuDir)) {
      return NextResponse.json({
        error: 'Folder public/kartu_emaal/ belum ada di server. Pastikan file kartu sudah di-push ke Git terlebih dahulu.',
        hint: 'Jalankan: node scripts/pair-kartu-emaal.js di komputer lokal, lalu git push.'
      }, { status: 404 });
    }

    const files = fs.readdirSync(kartuDir);
    let pairedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        skippedCount++;
        continue;
      }

      const nis = path.basename(filename, ext).trim();
      if (!nis) continue;

      const kartuUrl = `/kartu_emaal/${nis}.jpg`;

      // Update murid database record — set kartu_emaal_url dan barcode_id (jika belum ada)
      const [res] = await pool.execute<ResultSetHeader>(
        `UPDATE murid 
         SET barcode_id = COALESCE(barcode_id, ?),
             kartu_emaal_url = ?
         WHERE nis = ?`,
        [nis, kartuUrl, nis]
      );

      if (res.affectedRows > 0) {
        pairedCount++;
      } else {
        notFoundCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mempairing ${pairedCount} kartu santri eMaal (2026/2027)!`,
      stats: {
        total_file_kartu: files.length,
        santri_terpairing: pairedCount,
        santri_tidak_ditemukan_di_db: notFoundCount,
        dilewati_bukan_gambar: skippedCount
      }
    });

  } catch (error: any) {
    console.error('Error pairing kartu emaal:', error);
    return NextResponse.json({ error: 'Gagal mempairing kartu emaal: ' + error.message }, { status: 500 });
  }
}

// Alias POST → GET untuk kemudahan
export async function POST() {
  return GET();
}
