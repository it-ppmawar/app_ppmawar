import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync/kartu-emaal-bulk
 * 
 * Menerima array mapping {nis, barcode_id} dari script decode lokal
 * dan melakukan bulk UPDATE ke database murid.
 * 
 * Body: { mappings: [{nis: string, barcode_id: string}] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mappings: { nis: string; barcode_id: string }[] = body.mappings || [];

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json({ error: 'Data mappings kosong atau tidak valid' }, { status: 400 });
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    for (const item of mappings) {
      if (!item.nis || !item.barcode_id) {
        skippedCount++;
        continue;
      }

      const [res] = await pool.execute<ResultSetHeader>(
        `UPDATE murid 
         SET barcode_id = ? 
         WHERE nis = ?`,
        [item.barcode_id.trim(), item.nis.trim()]
      );

      if (res.affectedRows > 0) {
        updatedCount++;
      } else {
        notFoundCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk pairing selesai! ${updatedCount} santri berhasil diupdate.`,
      stats: {
        total_dikirim: mappings.length,
        berhasil_diupdate: updatedCount,
        tidak_ditemukan_di_db: notFoundCount,
        dilewati: skippedCount
      }
    });

  } catch (error: any) {
    console.error('Error bulk pairing kartu emaal:', error);
    return NextResponse.json({ error: 'Gagal bulk pairing: ' + error.message }, { status: 500 });
  }
}

// GET: alias untuk cek status endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ready', 
    message: 'Endpoint bulk pairing kartu eMaal aktif. Gunakan POST dengan body {mappings: [{nis, barcode_id}]}' 
  });
}
