import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const mappings: { nis: string; barcode_id: string }[] = body.mappings || [];
    const nisList: string[] = body.nis_list || [];

    let affectedRows = 0;

    // Mode 1: Bulk mappings QR token {nis, barcode_id}
    if (Array.isArray(mappings) && mappings.length > 0) {
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
    if (Array.isArray(nisList) && nisList.length > 0) {
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

export async function GET() {
  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE murid 
       SET barcode_id = nis 
       WHERE (barcode_id IS NULL OR barcode_id = '') AND nis IS NOT NULL AND nis != ''`
    );
    return NextResponse.json({
      success: true,
      message: `Berhasil mempairing barcode_id default untuk ${res.affectedRows} santri!`,
      stats: { santri_terpairing: res.affectedRows }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
