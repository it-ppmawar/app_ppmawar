import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jenis_kelamin = searchParams.get('jenis_kelamin');
    const kelas_madin_id = searchParams.get('kelas_madin_id');
    const kelas_quran_id = searchParams.get('kelas_quran_id');
    const kamar_id = searchParams.get('kamar_id');

    let sql = `
      SELECT mf.murid_id, m.nama, m.jenis_kelamin, m.nis, mf.descriptor, mf.foto_source, mf.updated_at
      FROM murid_face mf
      JOIN murid m ON mf.murid_id = m.murid_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (jenis_kelamin) {
      sql += ' AND m.jenis_kelamin = ?';
      params.push(jenis_kelamin);
    }

    if (kelas_madin_id) {
      sql += ' AND m.kelas_madin_id = ?';
      params.push(kelas_madin_id);
    }

    if (kelas_quran_id) {
      sql += ' AND m.kelas_quran_id = ?';
      params.push(kelas_quran_id);
    }

    if (kamar_id) {
      sql += ' AND m.kamar_id = ?';
      params.push(kamar_id);
    }

    sql += ' ORDER BY m.nama ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);

    // Format descriptor from JSON string or object to array
    const formatted = rows.map(r => ({
      murid_id: r.murid_id,
      nama: r.nama,
      nis: r.nis,
      jenis_kelamin: r.jenis_kelamin,
      foto_source: r.foto_source,
      descriptor: typeof r.descriptor === 'string' ? JSON.parse(r.descriptor) : r.descriptor,
      updated_at: r.updated_at
    }));

    return NextResponse.json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    console.error('Error fetching face descriptors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload as any;
    if (role !== 'admin' && role !== 'staff' && role !== 'guru' && role !== 'pengurus_asrama') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { murid_id, descriptor, foto_source } = body;

    if (!murid_id || !descriptor || !Array.isArray(descriptor)) {
      return NextResponse.json({ error: 'Parameter murid_id dan descriptor (array 128-d) wajib diisi' }, { status: 400 });
    }

    const descriptorJson = JSON.stringify(descriptor);

    const sql = `
      INSERT INTO murid_face (murid_id, descriptor, foto_source)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE descriptor = VALUES(descriptor), foto_source = VALUES(foto_source), updated_at = NOW()
    `;

    await pool.execute<ResultSetHeader>(sql, [murid_id, descriptorJson, foto_source || null]);

    return NextResponse.json({ success: true, message: `Vektor wajah murid_id ${murid_id} berhasil disimpan` });
  } catch (error: any) {
    console.error('Error saving face descriptor:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
