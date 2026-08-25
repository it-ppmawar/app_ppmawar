import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin Utama yang dapat melihat audit log' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const aksi = searchParams.get('aksi') || '';
    const tabel = searchParams.get('tabel') || '';
    const user_id = searchParams.get('user_id') || '';
    const tanggal = searchParams.get('tanggal') || ''; // YYYY-MM-DD
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (aksi) { where += ' AND aksi = ?'; params.push(aksi); }
    if (tabel) { where += ' AND tabel = ?'; params.push(tabel); }
    if (user_id) { where += ' AND user_id = ?'; params.push(parseInt(user_id)); }
    if (tanggal) { where += ' AND DATE(created_at) = ?'; params.push(tanggal); }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, user_id, user_nama, user_role, aksi, tabel, record_id, keterangan,
              data_lama, data_baru, ip_address, created_at
       FROM audit_log ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_log ${where}`,
      params
    );

    return NextResponse.json({
      success: true,
      data: rows,
      total: countRows[0]?.total || 0,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
