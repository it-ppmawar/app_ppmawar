/**
 * /api/sync/status/route.ts
 * Endpoint untuk mengambil status & waktu terakhir sinkronisasi Google Sheets.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = 'terakhir_sync_gsheet'`
    );

    const lastSync = rows.length > 0 ? rows[0].nilai : null;

    return NextResponse.json({
      success: true,
      last_sync: lastSync,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
