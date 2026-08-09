import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [rows]: any = await pool.execute(
      `SELECT murid_id, nis, nama, foto, barcode_id FROM murid LIMIT 20`
    );
    const [total]: any = await pool.execute(`SELECT COUNT(*) as total FROM murid`);
    const [withFoto]: any = await pool.execute(`SELECT COUNT(*) as cnt FROM murid WHERE foto IS NOT NULL AND foto != '' AND foto != '-'`);
    const [withBarcode]: any = await pool.execute(`SELECT COUNT(*) as cnt FROM murid WHERE barcode_id IS NOT NULL AND barcode_id != ''`);

    return NextResponse.json({
      total: total[0].total,
      withFoto: withFoto[0].cnt,
      withBarcode: withBarcode[0].cnt,
      sample: rows
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
