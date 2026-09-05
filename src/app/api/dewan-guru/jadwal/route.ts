import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const hari = searchParams.get('hari');
    const homebase = searchParams.get('homebase');

    // Pastikan tabel ada
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS jadwal_dewan_guru (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_sesi VARCHAR(150) NOT NULL,
        homebase VARCHAR(100) DEFAULT 'SEMUA',
        hari ENUM('Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu') NOT NULL,
        jam_mulai TIME NOT NULL,
        jam_selesai TIME NOT NULL,
        toleransi_menit INT NOT NULL DEFAULT 15,
        keterangan TEXT DEFAULT NULL,
        aktif TINYINT(1) NOT NULL DEFAULT 1,
        created_by VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_jadwal_hari (hari),
        INDEX idx_jadwal_homebase (homebase)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    let query = `SELECT * FROM jadwal_dewan_guru WHERE aktif = 1`;
    const params: any[] = [];

    if (hari && hari !== 'SEMUA') {
      query += ` AND hari = ?`;
      params.push(hari);
    }

    if (homebase && homebase !== 'SEMUA') {
      query += ` AND (homebase = ? OR homebase = 'SEMUA')`;
      params.push(homebase);
    }

    query += ` ORDER BY FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'), jam_mulai ASC`;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('[jadwal-dewan-guru] GET error:', error.message);
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
      return NextResponse.json({ error: 'Akses ditolak. Hanya Admin & Pengasuh yang dapat menambah jadwal.' }, { status: 403 });
    }

    const body = await request.json();
    const { nama_sesi, homebase, hari, jam_mulai, jam_selesai, toleransi_menit, keterangan } = body;

    if (!nama_sesi || !hari || !jam_mulai || !jam_selesai) {
      return NextResponse.json({ error: 'Nama sesi, hari, jam mulai, dan jam selesai wajib diisi.' }, { status: 400 });
    }

    const [res]: any = await pool.execute(`
      INSERT INTO jadwal_dewan_guru (nama_sesi, homebase, hari, jam_mulai, jam_selesai, toleransi_menit, keterangan, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nama_sesi.trim(),
      homebase || 'SEMUA',
      hari,
      jam_mulai,
      jam_selesai,
      toleransi_menit || 15,
      keterangan || null,
      payload.real_name || payload.username || 'Admin'
    ]);

    return NextResponse.json({ success: true, id: res.insertId, message: 'Jadwal absensi dewan guru berhasil disimpan.' });
  } catch (error: any) {
    console.error('[jadwal-dewan-guru] POST error:', error.message);
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
    const { id, nama_sesi, homebase, hari, jam_mulai, jam_selesai, toleransi_menit, keterangan, aktif } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID jadwal tidak disertakan.' }, { status: 400 });
    }

    await pool.execute(`
      UPDATE jadwal_dewan_guru
      SET nama_sesi = COALESCE(?, nama_sesi),
          homebase = COALESCE(?, homebase),
          hari = COALESCE(?, hari),
          jam_mulai = COALESCE(?, jam_mulai),
          jam_selesai = COALESCE(?, jam_selesai),
          toleransi_menit = COALESCE(?, toleransi_menit),
          keterangan = ?,
          aktif = COALESCE(?, aktif)
      WHERE id = ?
    `, [
      nama_sesi ? nama_sesi.trim() : null,
      homebase || null,
      hari || null,
      jam_mulai || null,
      jam_selesai || null,
      toleransi_menit !== undefined ? toleransi_menit : null,
      keterangan !== undefined ? keterangan : null,
      aktif !== undefined ? (aktif ? 1 : 0) : null,
      id
    ]);

    return NextResponse.json({ success: true, message: 'Jadwal berhasil diperbarui.' });
  } catch (error: any) {
    console.error('[jadwal-dewan-guru] PUT error:', error.message);
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

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && !isPengasuh) {
      return NextResponse.json({ error: 'Hanya Admin & Pengasuh yang dapat menghapus jadwal.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID jadwal tidak disertakan.' }, { status: 400 });

    await pool.execute('DELETE FROM jadwal_dewan_guru WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Jadwal berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
