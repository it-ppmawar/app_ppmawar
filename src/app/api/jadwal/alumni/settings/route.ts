import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

// GET: ambil hari siklus alumni (publik, tidak perlu login)
export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis 
       WHERE nama_pengaturan IN ('hari_siklus_alumni_index', 'pasaran_siklus_alumni')`
    );

    const data: Record<string, any> = {
      hari_siklus_alumni_index: 6,   // default: Sabtu
      pasaran_siklus_alumni: 'Pon'   // default: Pon
    };

    rows.forEach((row: any) => {
      if (row.nama_pengaturan === 'hari_siklus_alumni_index') {
        data.hari_siklus_alumni_index = parseInt(row.nilai) || 6;
      } else if (row.nama_pengaturan === 'pasaran_siklus_alumni') {
        data.pasaran_siklus_alumni = row.nilai || 'Pon';
      }
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    // Return default values gracefully if table not found
    return NextResponse.json({
      success: true,
      data: { hari_siklus_alumni_index: 6, pasaran_siklus_alumni: 'Pon' }
    });
  }
}

// POST: simpan hari siklus alumni (admin only)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Hanya admin yang dapat mengubah pengaturan ini' }, { status: 403 });
    }

    const body = await request.json();
    const { hari_siklus_alumni_index, pasaran_siklus_alumni } = body;

    const VALID_PASARAN = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'];
    const idx = parseInt(hari_siklus_alumni_index);

    if (isNaN(idx) || idx < 0 || idx > 6) {
      return NextResponse.json({ error: 'Hari tidak valid (0=Ahad, 6=Sabtu)' }, { status: 400 });
    }
    if (!VALID_PASARAN.includes(pasaran_siklus_alumni)) {
      return NextResponse.json({ error: 'Pasaran tidak valid' }, { status: 400 });
    }

    await pool.execute(
      `INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?`,
      ['hari_siklus_alumni_index', idx.toString(), idx.toString()]
    );
    await pool.execute(
      `INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?`,
      ['pasaran_siklus_alumni', pasaran_siklus_alumni, pasaran_siklus_alumni]
    );

    return NextResponse.json({ success: true, message: `Hari siklus alumni diperbarui ke ${pasaran_siklus_alumni} (index ${idx})` });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
