import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/pairing/barcode
 * Body: { murid_id: number, barcode_id: string }
 *
 * Memasangkan barcode/QR code ke santri berdasarkan murid_id.
 * Digunakan oleh Quick Pairing Panel di halaman scan-absen
 * ketika kartu yang di-scan belum terdaftar di sistem.
 */
export async function POST(request: Request) {
  try {
    const { murid_id, barcode_id } = await request.json();

    if (!murid_id || !barcode_id) {
      return NextResponse.json({ success: false, message: 'murid_id dan barcode_id wajib diisi.' }, { status: 400 });
    }

    const barcodeClean = String(barcode_id).trim();
    const muridIdNum = Number(murid_id);

    // Cek apakah barcode sudah dipakai santri lain
    const [existing] = await pool.execute<any[]>(
      'SELECT murid_id, nama FROM murid WHERE barcode_id = ? AND murid_id != ?',
      [barcodeClean, muridIdNum]
    );

    if (existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Barcode ini sudah terdaftar milik santri: ${existing[0].nama}. Hubungi admin untuk reset.`
      }, { status: 409 });
    }

    // Cek santri target ada
    const [muridRows] = await pool.execute<any[]>(
      'SELECT murid_id, nama, nis FROM murid WHERE murid_id = ?',
      [muridIdNum]
    );

    if (muridRows.length === 0) {
      return NextResponse.json({ success: false, message: 'Santri tidak ditemukan.' }, { status: 404 });
    }

    // Update barcode_id
    await pool.execute(
      'UPDATE murid SET barcode_id = ? WHERE murid_id = ?',
      [barcodeClean, muridIdNum]
    );

    return NextResponse.json({
      success: true,
      message: `Kartu berhasil dipasangkan ke ${muridRows[0].nama} (${muridRows[0].nis})!`,
      nama: muridRows[0].nama,
      nis: muridRows[0].nis,
    });

  } catch (error: any) {
    console.error('pairing/barcode error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server: ' + error.message }, { status: 500 });
  }
}
