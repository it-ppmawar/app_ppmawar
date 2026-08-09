import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

const ALLOWED_ROLES = ['admin', 'staff', 'pengasuh', 'pengurus_asrama', 'wali_murid', 'wali_alumni'];

function isAllowed(role: string): boolean {
  return ALLOWED_ROLES.some(r => role.toLowerCase().includes(r) || role === r);
}

// GET — Daftar panggilan (dengan filter asrama, status, tanggal)
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    if (!isAllowed(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterAsrama = searchParams.get('asrama') || '';
    const filterStatus = searchParams.get('status') || '';
    const filterDate = searchParams.get('tanggal') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    let where = '1=1';
    const params: any[] = [];

    // Wali murid hanya lihat panggilan milik santrinya sendiri
    if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
      if (!payload.muridId) return NextResponse.json({ success: true, data: [] });
      where += ' AND p.santri_id = ?';
      params.push(payload.muridId);
    }

    if (filterAsrama) {
      where += ' AND p.nama_asrama = ?';
      params.push(filterAsrama);
    }
    if (filterStatus) {
      where += ' AND p.status = ?';
      params.push(filterStatus);
    }
    if (filterDate) {
      where += ' AND DATE(p.created_at) = ?';
      params.push(filterDate);
    } else {
      // Default: hari ini
      where += ' AND DATE(p.created_at) = CURDATE()';
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, 
              DATE_FORMAT(p.created_at, '%H:%i') as jam_panggilan,
              DATE_FORMAT(p.dibacakan_at, '%H:%i') as jam_dibacakan
       FROM panggilan_santri p
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT ${limit}`,
      params
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('[API Panggilan GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Buat panggilan baru
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    if (!isAllowed(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const {
      santri_id,
      format_id,
      tujuan,
      teks_panggilan,
      pengulangan = 1,
    } = body;

    // Ambil bahasa & jenis_suara dari format (jika format_id diisi)
    let bahasaPanggilan = 'id';
    let jenisSuaraPanggilan = 'auto';
    if (format_id) {
      try {
        const [fRows]: any = await pool.execute(
          'SELECT bahasa, jenis_suara FROM format_panggilan WHERE id = ? LIMIT 1',
          [format_id]
        );
        if (fRows.length > 0) {
          bahasaPanggilan = fRows[0].bahasa || 'id';
          jenisSuaraPanggilan = fRows[0].jenis_suara || 'auto';
        }
      } catch (_) {}
    }

    if (!santri_id || !teks_panggilan) {
      return NextResponse.json({ error: 'santri_id dan teks_panggilan wajib diisi' }, { status: 400 });
    }

    // Ambil data santri
    const [santriRows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.murid_id, m.nama, m.nama_panggilan, m.kamar_id,
              k.nama_kamar, k.nama_asrama
       FROM murid m
       LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
       WHERE m.murid_id = ? LIMIT 1`,
      [santri_id]
    );

    if (santriRows.length === 0) {
      return NextResponse.json({ error: 'Santri tidak ditemukan' }, { status: 404 });
    }

    // Wali murid hanya boleh panggil santri miliknya
    if ((payload.role === 'wali_murid' || payload.role === 'wali_alumni') && payload.muridId !== santri_id) {
      return NextResponse.json({ error: 'Akses ditolak: bukan santri Anda' }, { status: 403 });
    }

    const santri = santriRows[0];

    // Ambil nama pemanggil
    let namaPemanggil = payload.username;
    try {
      if (payload.role === 'guru' && payload.guruId) {
        const [g]: any = await pool.execute('SELECT nama FROM guru WHERE guru_id = ? LIMIT 1', [payload.guruId]);
        if (g.length > 0) namaPemanggil = g[0].nama;
      } else if ((payload.role === 'wali_murid' || payload.role === 'wali_alumni') && payload.muridId) {
        const [m]: any = await pool.execute('SELECT nama_wali FROM murid WHERE murid_id = ? LIMIT 1', [payload.muridId]);
        if (m.length > 0) namaPemanggil = m[0].nama_wali;
      } else if (payload.userId) {
        const [u]: any = await pool.execute('SELECT nama FROM users WHERE id = ? LIMIT 1', [payload.userId]);
        if (u.length > 0 && u[0].nama) namaPemanggil = u[0].nama;
      }
    } catch (_) {}

    const [result]: any = await pool.execute(
      `INSERT INTO panggilan_santri 
        (santri_id, santri_nama, santri_nama_panggilan, kamar_id, nama_kamar, nama_asrama, 
         dipanggil_oleh, peran_pemanggil, nama_pemanggil, format_id, teks_panggilan, tujuan, pengulangan, bahasa, jenis_suara, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        santri.murid_id,
        santri.nama,
        santri.nama_panggilan || santri.nama,
        santri.kamar_id || null,
        santri.nama_kamar || null,
        santri.nama_asrama || null,
        payload.userId || 0,
        payload.role,
        namaPemanggil,
        format_id || null,
        teks_panggilan,
        tujuan || null,
        pengulangan ?? 1,
        bahasaPanggilan,
        jenisSuaraPanggilan,
      ]
    );

    return NextResponse.json({ 
      success: true, 
      message: `Panggilan untuk ${santri.nama} berhasil dikirim!`,
      id: result.insertId,
      asrama: santri.nama_asrama,
    });
  } catch (error: any) {
    console.error('[API Panggilan POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
