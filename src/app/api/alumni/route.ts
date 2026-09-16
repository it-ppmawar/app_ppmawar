import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

// Helper to verify admin/staff role
async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const { role } = payload as any;
  if (role !== 'admin' && role !== 'staff') return null;

  return payload;
}

// GET: Get all alumni or search
export async function GET(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureAlumniColumns();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const kategori = searchParams.get('kategori') || '';

    let sql = 'SELECT * FROM alumni WHERE 1=1';
    let params: any[] = [];

    if (search) {
      sql += ` AND (
        nama LIKE ? OR 
        nis LIKE ? OR 
        nik LIKE ? OR 
        no_hp LIKE ? OR
        alamat LIKE ? OR
        kategori_mukim LIKE ? OR
        status_keluar LIKE ? OR
        keterangan LIKE ? OR
        nama_wali LIKE ? OR
        no_hp_wali LIKE ? OR
        CAST(tahun_masuk AS CHAR) LIKE ? OR
        CAST(tahun_keluar AS CHAR) LIKE ?
      )`;
      const likeVal = `%${search}%`;
      params.push(likeVal, likeVal, likeVal, likeVal, likeVal, likeVal, likeVal, likeVal, likeVal, likeVal, likeVal, likeVal);
    }

    if (kategori === 'PPM' || kategori === 'LPPM') {
      sql += ' AND kategori_mukim = ?';
      params.push(kategori);
    }

    sql += ' ORDER BY tahun_keluar DESC, nama ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error GET /api/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// Helper untuk memastikan kolom-kolom baru (seperti nama_wali, no_hp_wali) tersedia di tabel alumni
async function ensureAlumniColumns() {
  try {
    const [colRows]: any = await pool.execute('SHOW COLUMNS FROM alumni');
    const existingCols = new Set<string>(colRows.map((c: any) => c.Field.toLowerCase()));
    if (!existingCols.has('nama_wali')) {
      await pool.execute('ALTER TABLE alumni ADD COLUMN nama_wali VARCHAR(255) NULL');
    }
    if (!existingCols.has('no_hp_wali')) {
      await pool.execute('ALTER TABLE alumni ADD COLUMN no_hp_wali VARCHAR(50) NULL');
    }
  } catch (err) {
    // Abaikan jika error
  }
}

// PUT: Update alumni data
export async function PUT(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureAlumniColumns();

    const body = await request.json();
    const {
      alumni_id,
      nama,
      nis,
      nik,
      no_hp,
      alamat,
      tahun_masuk,
      tahun_keluar,
      status_keluar,
      jenis_kelamin,
      kategori_mukim,
      keterangan,
      nama_wali,
      no_hp_wali
    } = body;

    if (!alumni_id || !nama || !nis) {
      return NextResponse.json({ error: 'Data wajib (Nama, NIS) belum lengkap' }, { status: 400 });
    }

    const sql = `
      UPDATE alumni 
      SET nama = ?, nis = ?, nik = ?, no_hp = ?, alamat = ?, 
          tahun_masuk = ?, tahun_keluar = ?, status_keluar = ?,
          jenis_kelamin = ?, kategori_mukim = ?, keterangan = ?,
          nama_wali = ?, no_hp_wali = ?
      WHERE alumni_id = ?
    `;
    const params = [
      nama,
      nis,
      nik || null,
      no_hp || null,
      alamat || null,
      tahun_masuk || null,
      tahun_keluar || null,
      status_keluar || 'Lulus',
      jenis_kelamin || null,
      kategori_mukim || 'PPM',
      keterangan || null,
      nama_wali || null,
      no_hp_wali || null,
      alumni_id
    ];

    const [result] = await pool.execute<ResultSetHeader>(sql, params);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data alumni tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data alumni berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error PUT /api/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// POST: Add new alumni individually
export async function POST(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureAlumniColumns();

    const body = await request.json();
    const {
      nama, nis, nik, no_hp, alamat,
      tahun_masuk, tahun_keluar, status_keluar,
      jenis_kelamin, kategori_mukim, keterangan,
      nama_wali, no_hp_wali
    } = body;

    if (!nama) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    }

    const sql = `
      INSERT INTO alumni 
      (nama, nis, nik, no_hp, alamat, tahun_masuk, tahun_keluar, status_keluar, jenis_kelamin, kategori_mukim, keterangan, nama_wali, no_hp_wali)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      nama,
      nis || '',
      nik || null,
      no_hp || null,
      alamat || null,
      tahun_masuk || null,
      tahun_keluar || null,
      status_keluar || 'Lulus',
      jenis_kelamin || null,
      kategori_mukim || 'PPM',
      keterangan || null,
      nama_wali || null,
      no_hp_wali || null
    ];

    const [result] = await pool.execute<ResultSetHeader>(sql, params);
    return NextResponse.json({ success: true, message: 'Data alumni berhasil ditambahkan', insertId: result.insertId });
  } catch (error: any) {
    console.error('Error POST /api/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// DELETE: Delete alumni permanently
export async function DELETE(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID Alumni tidak valid' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM alumni WHERE alumni_id = ?', [id]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data alumni tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data alumni berhasil dihapus permanen' });
  } catch (error: any) {
    console.error('Error DELETE /api/alumni:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
