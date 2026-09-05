import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const homebase = searchParams.get('homebase');
    const search = searchParams.get('search');
    const all = searchParams.get('all') === 'true';

    // Pastikan tabel ada
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS dewan_guru (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nip VARCHAR(50) DEFAULT NULL,
        nama VARCHAR(255) NOT NULL,
        jenis_kelamin ENUM('L', 'P') NOT NULL DEFAULT 'L',
        homebase VARCHAR(100) NOT NULL DEFAULT 'YPMA',
        no_hp VARCHAR(50) DEFAULT NULL,
        alamat TEXT DEFAULT NULL,
        tempat_tgl_lahir VARCHAR(150) DEFAULT NULL,
        nama_ibu VARCHAR(150) DEFAULT NULL,
        suami_istri VARCHAR(150) DEFAULT NULL,
        pendidikan_terakhir VARCHAR(150) DEFAULT NULL,
        status_kepegawaian VARCHAR(50) DEFAULT NULL,
        qr_token VARCHAR(100) NOT NULL UNIQUE,
        foto VARCHAR(255) DEFAULT NULL,
        aktif TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_homebase (homebase),
        INDEX idx_qr_token (qr_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    let query = `SELECT * FROM dewan_guru WHERE aktif = 1`;
    const params: any[] = [];

    if (homebase && homebase !== 'SEMUA') {
      query += ` AND homebase = ?`;
      params.push(homebase);
    }

    if (search) {
      query += ` AND (nama LIKE ? OR homebase LIKE ? OR no_hp LIKE ? OR nip LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY homebase ASC, nama ASC`;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);

    // Ambil rekapitulasi homebase
    const [stats] = await pool.execute<RowDataPacket[]>(`
      SELECT homebase, COUNT(*) as count,
             SUM(CASE WHEN jenis_kelamin = 'L' THEN 1 ELSE 0 END) as count_l,
             SUM(CASE WHEN jenis_kelamin = 'P' THEN 1 ELSE 0 END) as count_p,
             SUM(CASE WHEN no_hp IS NOT NULL AND no_hp != '' THEN 1 ELSE 0 END) as count_hp
      FROM dewan_guru
      WHERE aktif = 1
      GROUP BY homebase
      ORDER BY count DESC
    `);

    return NextResponse.json({
      success: true,
      total: rows.length,
      data: rows,
      stats
    });
  } catch (error: any) {
    console.error('[dewan-guru] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && payload.role !== 'staff' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const body = await request.json();
    const { nama, jenis_kelamin, homebase, no_hp, alamat, nip } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama guru wajib diisi.' }, { status: 400 });
    }

    const qrToken = 'dg_' + crypto.randomBytes(12).toString('hex');
    const [res]: any = await pool.execute(`
      INSERT INTO dewan_guru (nip, nama, jenis_kelamin, homebase, no_hp, alamat, qr_token, aktif)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      nip || null,
      nama.trim(),
      jenis_kelamin === 'P' ? 'P' : 'L',
      homebase || 'YPMA',
      no_hp || null,
      alamat || null,
      qrToken
    ]);

    return NextResponse.json({
      success: true,
      id: res.insertId,
      qr_token: qrToken,
      message: 'Dewan guru berhasil ditambahkan.'
    });
  } catch (error: any) {
    console.error('[dewan-guru] POST error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && payload.role !== 'staff' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, nama, jenis_kelamin, homebase, no_hp, alamat, nip, aktif } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID guru tidak disertakan.' }, { status: 400 });
    }

    await pool.execute(`
      UPDATE dewan_guru
      SET nama = COALESCE(?, nama),
          jenis_kelamin = COALESCE(?, jenis_kelamin),
          homebase = COALESCE(?, homebase),
          no_hp = ?,
          alamat = ?,
          nip = ?,
          aktif = COALESCE(?, aktif)
      WHERE id = ?
    `, [
      nama ? nama.trim() : null,
      jenis_kelamin ? (jenis_kelamin === 'P' ? 'P' : 'L') : null,
      homebase ? homebase.trim() : null,
      no_hp !== undefined ? no_hp : null,
      alamat !== undefined ? alamat : null,
      nip !== undefined ? nip : null,
      aktif !== undefined ? (aktif ? 1 : 0) : null,
      id
    ]);

    return NextResponse.json({ success: true, message: 'Data dewan guru berhasil diperbarui.' });
  } catch (error: any) {
    console.error('[dewan-guru] PUT error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat menghapus guru.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID guru tidak disertakan.' }, { status: 400 });

    await pool.execute('DELETE FROM dewan_guru WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Data guru berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
