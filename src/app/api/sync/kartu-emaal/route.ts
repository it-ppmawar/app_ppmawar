import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

/**
 * GET / POST /api/sync/kartu-emaal
 * 
 * Otomatis mempairing barcode_id santri baru dengan NIS mereka masing-masing.
 * Kartu eMaal (QR / Barcode) menggunakan NIS santri sebagai token absensi.
 * Tidak membutuhkan upload/penyimpanan file gambar di server.
 */
export async function GET(request?: Request) {
  try {
    let nisList: string[] = [];

    // Jika dipanggil via POST dengan body array NIS
    if (request && request.method === 'POST') {
      try {
        const body = await request.json();
        if (Array.isArray(body.nis_list)) {
          nisList = body.nis_list;
        }
      } catch (e) {
        // abaikan jika body kosong
      }
    }

    let affectedRows = 0;

    if (nisList.length > 0) {
      // Pairing khusus untuk NIS yang dikirim
      for (const nis of nisList) {
        const [res] = await pool.execute<ResultSetHeader>(
          `UPDATE murid 
           SET barcode_id = ? 
           WHERE nis = ? AND (barcode_id IS NULL OR barcode_id = '')`,
          [nis, nis]
        );
        if (res.affectedRows > 0) affectedRows++;
      }
    } else {
      // Auto-pairing seluruh santri yang belum punya barcode_id
      const [res] = await pool.execute<ResultSetHeader>(
        `UPDATE murid 
         SET barcode_id = nis 
         WHERE (barcode_id IS NULL OR barcode_id = '') AND nis IS NOT NULL AND nis != ''`
      );
      affectedRows = res.affectedRows;
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mempairing barcode_id untuk ${affectedRows} santri!`,
      stats: {
        santri_terpairing: affectedRows
      }
    });

  } catch (error: any) {
    console.error('Error pairing barcode_id kartu:', error);
    return NextResponse.json({ error: 'Gagal mempairing kartu: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
