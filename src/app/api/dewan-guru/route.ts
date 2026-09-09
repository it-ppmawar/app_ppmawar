import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import crypto from 'crypto';
import { ensureDewanGuruDB } from '@/lib/ensureDewanGuruDB';

export async function GET(request: Request) {
  try {
    await ensureDewanGuruDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const homebase = searchParams.get('homebase');
    const search = searchParams.get('search');
    const all = searchParams.get('all') === 'true';

    const userRole = (payload.role || '').toLowerCase();

    // Khusus role guru: Hanya tampilkan data QR Code miliknya sendiri
    if (userRole === 'guru') {
      let guruNama = '';
      let guruNip = '';
      let guruPhone = '';

      if (payload.guruId) {
        const [gRows]: any = await pool.execute('SELECT nama, nip, no_hp FROM guru WHERE guru_id = ? LIMIT 1', [payload.guruId]);
        if (gRows && gRows.length > 0) {
          guruNama = gRows[0].nama || '';
          guruNip = gRows[0].nip || '';
          guruPhone = gRows[0].no_hp || '';
        }
      }

      if (!guruNama && payload.userId) {
        const [uRows]: any = await pool.execute('SELECT nama, username FROM users WHERE id = ? LIMIT 1', [payload.userId]);
        if (uRows && uRows.length > 0) {
          guruNama = uRows[0].nama || '';
        }
      }

      if (!guruNama && payload.username) {
        guruNama = payload.username;
      }

      let matchedRows: any[] = [];

      // 1. Coba match via NIP jika tersedia
      if (guruNip && guruNip.trim()) {
        const [rows]: any = await pool.execute('SELECT * FROM dewan_guru WHERE aktif = 1 AND nip = ? LIMIT 1', [guruNip.trim()]);
        if (rows && rows.length > 0) matchedRows = rows;
      }

      // 2. Coba match exact nama (case-insensitive & trimmed)
      if (matchedRows.length === 0 && guruNama && guruNama.trim()) {
        const [rows]: any = await pool.execute('SELECT * FROM dewan_guru WHERE aktif = 1 AND LOWER(TRIM(nama)) = LOWER(TRIM(?)) LIMIT 1', [guruNama.trim()]);
        if (rows && rows.length > 0) matchedRows = rows;
      }

      // 3. Coba match nama tanpa gelar (membersihkan Drs., H., Hj., S.Pd., dll)
      if (matchedRows.length === 0 && guruNama && guruNama.trim()) {
        const cleanName = guruNama
          .replace(/^(drs|dra|dr|kh|h|hj|ust|ustadz|ustadzah)\.?\s+/i, '')
          .replace(/,\s*(s\.pd|s\.e|s\.ag|m\.pd|m\.ag|m\.si|s\.kom|s\.sos|s\.farm|apt|lc).*$/i, '')
          .trim();
        if (cleanName.length >= 3) {
          const [rows]: any = await pool.execute(
            'SELECT * FROM dewan_guru WHERE aktif = 1 AND LOWER(nama) LIKE ? LIMIT 1',
            [`%${cleanName.toLowerCase()}%`]
          );
          if (rows && rows.length > 0) matchedRows = rows;
        }
      }

      // 4. Coba match nomor HP jika ada
      if (matchedRows.length === 0 && guruPhone && guruPhone.trim().length >= 8) {
        const cleanPhone = guruPhone.replace(/[^0-9]/g, '').slice(-9);
        const [rows]: any = await pool.execute(
          'SELECT * FROM dewan_guru WHERE aktif = 1 AND REPLACE(REPLACE(no_hp, "-", ""), " ", "") LIKE ? LIMIT 1',
          [`%${cleanPhone}`]
        );
        if (rows && rows.length > 0) matchedRows = rows;
      }

      return NextResponse.json({
        success: true,
        isPersonal: true,
        total: matchedRows.length,
        data: matchedRows,
        stats: []
      });
    }

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
