import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

/**
 * GET / POST /api/sync/kartu-emaal
 * 
 * Synchronize/pair barcode_id santri baru.
 * Mendukung:
 * 1. POST body { mappings: [{nis: string, barcode_id: string}] } (Pairing dari QR token yang dibaca)
 * 2. POST body { nis_list: string[] }
 * 3. GET/POST tanpa body (Auto-pairing barcode_id = nis)
 */
export async function GET(request?: Request) {
  try {
    let mappings: { nis: string; barcode_id: string }[] = [];
    let nisList: string[] = [];

    if (request && request.method === 'POST') {
      try {
        const body = await request.json();
        if (Array.isArray(body.mappings)) {
          mappings = body.mappings;
        } else if (Array.isArray(body.nis_list)) {
          nisList = body.nis_list;
        }
      } catch (e) {
        // abaikan jika body kosong
      }
    }

    let affectedRows = 0;

    // Mode 1: Multi-mapping QR Token {nis, barcode_id}
    if (mappings.length > 0) {
      for (const item of mappings) {
        if (!item.nis || !item.barcode_id) continue;
        const [res] = await pool.execute<ResultSetHeader>(
          `UPDATE murid 
           SET barcode_id = ? 
           WHERE nis = ?`,
          [item.barcode_id.trim(), item.nis.trim()]
        );
        if (res.affectedRows > 0) affectedRows++;
      }
      return NextResponse.json({
        success: true,
        message: `Berhasil mempairing QR token untuk ${affectedRows} santri!`,
        stats: {
          total_dikirim: mappings.length,
          santri_terpairing: affectedRows
        }
      });
    }

    // Mode 2: Array NIS khusus
    if (nisList.length > 0) {
      for (const nis of nisList) {
        const [res] = await pool.execute<ResultSetHeader>(
          `UPDATE murid 
           SET barcode_id = ? 
           WHERE nis = ? AND (barcode_id IS NULL OR barcode_id = '')`,
          [nis, nis]
        );
        if (res.affectedRows > 0) affectedRows++;
      }
      return NextResponse.json({
        success: true,
        message: `Berhasil mempairing barcode_id untuk ${affectedRows} santri!`,
        stats: { santri_terpairing: affectedRows }
      });
    }

    // Mode 3: Auto-pairing default (barcode_id = nis)
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE murid 
       SET barcode_id = nis 
       WHERE (barcode_id IS NULL OR barcode_id = '') AND nis IS NOT NULL AND nis != ''`
    );
    affectedRows = res.affectedRows;

    return NextResponse.json({
      success: true,
      message: `Berhasil mempairing barcode_id default untuk ${affectedRows} santri!`,
      stats: { santri_terpairing: affectedRows }
    });

  } catch (error: any) {
    console.error('Error pairing barcode_id kartu:', error);
    return NextResponse.json({ error: 'Gagal mempairing kartu: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
