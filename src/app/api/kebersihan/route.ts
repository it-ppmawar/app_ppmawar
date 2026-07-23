import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

const ALLOWED_ROLES = ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'petugas', 'petugas_umum', 'petugas_sarpras', 'guru', 'petugas_kebersihan', 'petugas_kebersihan_umum'];

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, userId, username, isPengasuh, isPengurusAsrama } = payload;
    const tokenAsrama = payload.namaAsrama || null;

    // Guru hanya boleh jika is_pengasuh atau is_pengurus_asrama
    if (role === 'guru' && !isPengasuh && !isPengurusAsrama) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const asramaFilter = searchParams.get('asrama');

    let query = `
      SELECT k.*, km.nama_kamar
      FROM kebersihan k
      LEFT JOIN kamar km ON k.kamar_id = km.kamar_id
    `;
    let params: any[] = [];

    if (['admin', 'staff'].includes(role)) {
      if (asramaFilter && asramaFilter !== 'semua') {
        query += ' WHERE k.asrama = ?';
        params.push(asramaFilter);
      }
    } else {
      // Resolve asrama for non-admin users
      const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
      const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);
      if (!namaAsrama) {
        return NextResponse.json({ success: true, data: [] });
      }
      query += ' WHERE k.asrama = ?';
      params.push(namaAsrama);
    }

    query += ' ORDER BY k.asrama ASC, k.nama_item ASC';
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Hanya admin/staff yang dapat menambah item kebersihan' }, { status: 403 });
    }

    const body = await request.json();
    const { nama_item, kategori, asrama, kamar_id, jumlah, kondisi, keterangan } = body;

    if (!nama_item || !kategori || !asrama) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const [result] = await pool.execute(
      'INSERT INTO kebersihan (nama_item, kategori, asrama, kamar_id, jumlah, kondisi, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nama_item, kategori, asrama, kamar_id || null, jumlah || 1, kondisi || 'Bersih', keterangan || null]
    ) as any;

    return NextResponse.json({ success: true, id: result.insertId, message: 'Item kebersihan berhasil ditambahkan' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, isPengasuh } = payload;
    if (role === 'guru' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { id, nama_item, kategori, asrama, kamar_id, jumlah, kondisi, keterangan } = body;

    if (!id || !nama_item || !kategori || !asrama) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    await pool.execute(
      'UPDATE kebersihan SET nama_item = ?, kategori = ?, asrama = ?, kamar_id = ?, jumlah = ?, kondisi = ?, keterangan = ? WHERE id = ?',
      [nama_item, kategori, asrama, kamar_id || null, jumlah || 1, kondisi, keterangan || null, id]
    );

    return NextResponse.json({ success: true, message: 'Item kebersihan berhasil diperbarui' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Hanya admin/staff yang dapat menghapus item kebersihan' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    await pool.execute('DELETE FROM kebersihan WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Item kebersihan berhasil dihapus' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
