import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * GET /api/murid/face-enrollment-status
 * Returns all murid with enrollment status (joined with murid_face table)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jenis_kelamin = searchParams.get('jenis_kelamin');
    const kelas_madin_id = searchParams.get('kelas_madin_id');

    let sql = `
      SELECT
        m.murid_id,
        m.nama,
        m.nis,
        m.jenis_kelamin,
        m.foto,
        km.nama_kelas AS kelas_madin,
        CASE WHEN mf.murid_id IS NOT NULL THEN 1 ELSE 0 END AS enrolled,
        mf.updated_at AS descriptor_updated_at
      FROM murid m
      LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
      LEFT JOIN murid_face mf ON m.murid_id = mf.murid_id
      WHERE m.status = 'Aktif' OR m.status IS NULL
    `;

    const params: any[] = [];

    if (jenis_kelamin) {
      sql += ' AND m.jenis_kelamin = ?';
      params.push(jenis_kelamin);
    }

    if (kelas_madin_id) {
      sql += ' AND m.kelas_madin_id = ?';
      params.push(Number(kelas_madin_id));
    }

    sql += ' ORDER BY m.nama ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);

    const data = rows.map(r => ({
      murid_id: r.murid_id,
      nama: r.nama,
      nis: r.nis,
      jenis_kelamin: r.jenis_kelamin,
      foto: r.foto || null,
      kelas_madin: r.kelas_madin || null,
      enrolled: r.enrolled === 1,
      descriptor_updated_at: r.descriptor_updated_at || null,
    }));

    const enrolled = data.filter(d => d.enrolled).length;

    return NextResponse.json({
      success: true,
      total: data.length,
      enrolled,
      unenrolled: data.length - enrolled,
      data
    });
  } catch (error: any) {
    console.error('face-enrollment-status error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
