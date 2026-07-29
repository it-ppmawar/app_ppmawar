import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const sourceDir = 'D:\\koding\\app.ppmawar\\KARTU EMAAL 2026 2027';
    if (!fs.existsSync(sourceDir)) {
      return NextResponse.json({ error: 'Folder Kartu eMaal tidak ditemukan di ' + sourceDir }, { status: 404 });
    }

    // Destination in public folder
    const targetDir = path.join(process.cwd(), 'public', 'kartu_emaal');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const files = fs.readdirSync(sourceDir);
    let pairedCount = 0;
    let copiedCount = 0;
    let skippedCount = 0;

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        skippedCount++;
        continue;
      }

      const nis = path.basename(filename, ext).trim();
      if (!nis) continue;

      const srcFile = path.join(sourceDir, filename);
      const destFile = path.join(targetDir, `${nis}.jpg`);

      // Copy file to public/kartu_emaal/
      try {
        fs.copyFileSync(srcFile, destFile);
        copiedCount++;
      } catch (e) {
        console.error(`Gagal menyalin kartu ${filename}:`, e);
      }

      const kartuUrl = `/kartu_emaal/${nis}.jpg`;

      // Update murid database record
      const [res] = await pool.execute<ResultSetHeader>(
        `UPDATE murid 
         SET barcode_id = COALESCE(barcode_id, ?),
             kartu_emaal_url = ?
         WHERE nis = ?`,
        [nis, kartuUrl, nis]
      );

      if (res.affectedRows > 0) {
        pairedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mempairing ${pairedCount} kartu santri baru eMaal (2026/2027)!`,
      stats: {
        total_file: files.length,
        file_disalin: copiedCount,
        santri_terpairing: pairedCount,
        dilewati: skippedCount
      }
    });

  } catch (error: any) {
    console.error('Error pairing kartu emaal:', error);
    return NextResponse.json({ error: 'Gagal mempairing kartu emaal: ' + error.message }, { status: 500 });
  }
}

export async function GET() {
  return POST({} as any);
}
