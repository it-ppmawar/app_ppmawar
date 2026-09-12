import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noCacheHeaders = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noCacheHeaders });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401, headers: noCacheHeaders });

    const { searchParams } = new URL(request.url);
    const tipe = searchParams.get('tipe');
    const target_id = searchParams.get('target_id') || '';

    if (!tipe || !['madin', 'quran', 'kegiatan'].includes(tipe)) {
      return NextResponse.json({ success: true, data: [] }, { headers: noCacheHeaders });
    }

    let rows: RowDataPacket[] = [];

    if (tipe === 'madin') {
      let query = `SELECT DISTINCT j.mata_pelajaran as nama FROM jadwal_madin j WHERE j.mata_pelajaran IS NOT NULL AND j.mata_pelajaran != ''`;
      const params: any[] = [];
      if (target_id && !['all','putra','putri'].includes(target_id)) {
        query += ` AND j.kelas_madin_id = ?`;
        params.push(target_id);
      }
      query += ` ORDER BY j.mata_pelajaran ASC`;
      [rows] = await pool.execute<RowDataPacket[]>(query, params);
    } else if (tipe === 'quran') {
      let query = `SELECT DISTINCT j.mata_pelajaran as nama FROM jadwal_quran j WHERE j.mata_pelajaran IS NOT NULL AND j.mata_pelajaran != ''`;
      const params: any[] = [];
      if (target_id && !['all','putra','putri'].includes(target_id)) {
        query += ` AND j.kelas_quran_id = ?`;
        params.push(target_id);
      }
      query += ` ORDER BY j.mata_pelajaran ASC`;
      [rows] = await pool.execute<RowDataPacket[]>(query, params);
    } else if (tipe === 'kegiatan') {
      let query = `SELECT DISTINCT j.nama_kegiatan as nama FROM jadwal_kegiatan j WHERE j.nama_kegiatan IS NOT NULL AND j.nama_kegiatan != ''`;
      const params: any[] = [];
      if (target_id && !['all'].includes(target_id) && !target_id.startsWith('asrama_')) {
        query += ` AND j.kamar_id = ?`;
        params.push(target_id);
      }
      query += ` ORDER BY j.nama_kegiatan ASC`;
      [rows] = await pool.execute<RowDataPacket[]>(query, params);
    }

    return NextResponse.json({ success: true, data: rows }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error('[rekapitulasi/sub-filter] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: noCacheHeaders });
  }
}
