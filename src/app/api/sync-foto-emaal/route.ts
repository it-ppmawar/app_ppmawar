import pool from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/sync-foto-emaal
 * 
 * Synchronize QR/barcode_id and remote photo references for EMAAL2 cards
 * WITHOUT needing any image file uploads to cPanel server.
 * 
 * 1. Pairs barcode_id = nis so QR scan works instantly
 * 2. Sets foto = Berkas_2026_{nis}.jpg so photos load directly from remote server
 */
export async function GET() {
  const targetNisList = [
    '2023080538', '2023080636', '2025080670', '2026050011', '2026050050',
    '2026050116', '2026050122', '2026060151', '2026060158', '2026060162',
    '2026060173', '2026060181', '2026060195', '2026060204', '2026060229',
    '2026060248', '2026060254', '2026060278', '2026060284', '2026060294',
    '2026060295', '2026060296', '2026060299', '2026070322', '2026070341',
    '2026070354', '2026070358', '2026070361', '2026070390', '2026070391',
    '2026070392', '2026070410', '2026070420', '2026070421', '2026070426',
    '2026070428', '2026070429', '2026070430', '2026070500', '2026070501',
    '2026070581', '2026070621', '2026070625', '2026080632', '2506020001',
    '2506020002', '2506020003'
  ];

  let updatedFotoCount = 0;
  let updatedBarcodeCount = 0;

  try {
    // 1. Auto-pair barcode_id = nis untuk seluruh murid yang barcode_id-nya belum terisi
    const [barcodeRes]: any = await pool.execute(`
      UPDATE murid 
      SET barcode_id = nis 
      WHERE (barcode_id IS NULL OR barcode_id = '' OR barcode_id = '-') AND nis IS NOT NULL AND nis != ''
    `);
    updatedBarcodeCount = barcodeRes.affectedRows || 0;

    // 2. Set foto = Berkas_2026_{nis}.jpg untuk 47 santri EMAAL2 (tanpa upload file fisik ke cPanel)
    for (const nis of targetNisList) {
      const remoteFotoName = `Berkas_2026_${nis}.jpg`;
      const [res]: any = await pool.execute(
        `UPDATE murid 
         SET foto = ?, barcode_id = ? 
         WHERE nis = ?`,
        [remoteFotoName, nis, nis]
      );
      if (res.affectedRows > 0) {
        updatedFotoCount++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_emaal2: targetNisList.length,
        santri_emaal2_updated: updatedFotoCount,
        total_barcode_paired: updatedBarcodeCount
      },
      message: `✅ Sinkronisasi berhasil tanpa beban server! ${updatedFotoCount} foto kartu EMAAL2 terhubung ke remote server, & ${updatedBarcodeCount} QR barcode_id berhasil dipairing.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

