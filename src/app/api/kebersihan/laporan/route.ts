import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

const ALLOWED_ROLES = ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'petugas', 'petugas_umum', 'petugas_sarpras', 'guru'];

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, userId, username, isPengasuh } = payload;
    const tokenAsrama = payload.namaAsrama || null;

    if (role === 'guru' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const asramaFilter = searchParams.get('asrama');
    const kebersihan_id = searchParams.get('kebersihan_id');

    let query = `
      SELECT lk.*, 
             k.nama_item, k.kategori, k.asrama, k.kondisi as kondisi_saat_ini,
             u_pelapor.nama as nama_pelapor,
             u_petugas.nama as nama_petugas
      FROM laporan_kebersihan lk
      JOIN kebersihan k ON lk.kebersihan_id = k.id
      JOIN users u_pelapor ON lk.pelapor_id = u_pelapor.id
      LEFT JOIN users u_petugas ON lk.petugas_id = u_petugas.id
    `;
    let params: any[] = [];
    const conditions: string[] = [];

    if (kebersihan_id) {
      conditions.push('lk.kebersihan_id = ?');
      params.push(kebersihan_id);
    }

    if (['admin', 'staff'].includes(role)) {
      if (asramaFilter && asramaFilter !== 'semua') {
        conditions.push('k.asrama = ?');
        params.push(asramaFilter);
      }
    } else {
      const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
      const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);
      if (!namaAsrama) {
        return NextResponse.json({ success: true, data: [] });
      }
      conditions.push('k.asrama = ?');
      params.push(namaAsrama);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY lk.created_at DESC';

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
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, userId, isPengasuh } = payload;
    if (role === 'guru' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { kebersihan_id, deskripsi_masalah } = body;

    if (!kebersihan_id || !deskripsi_masalah) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Cek kebersihan item
    const [items] = await pool.execute<RowDataPacket[]>('SELECT id FROM kebersihan WHERE id = ?', [kebersihan_id]);
    if (items.length === 0) return NextResponse.json({ error: 'Item kebersihan tidak ditemukan' }, { status: 404 });

    const [result] = await pool.execute(
      'INSERT INTO laporan_kebersihan (kebersihan_id, pelapor_id, deskripsi_masalah, status) VALUES (?, ?, ?, ?)',
      [kebersihan_id, userId, deskripsi_masalah, 'Dilaporkan']
    ) as any;

    // Update kondisi item menjadi 'Kotor Ringan' jika masih Bersih
    await pool.execute(
      "UPDATE kebersihan SET kondisi = 'Kotor Ringan' WHERE id = ? AND kondisi = 'Bersih'",
      [kebersihan_id]
    );

    return NextResponse.json({ success: true, id: result.insertId, message: 'Laporan kebersihan berhasil dikirim' });
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

    const { role, userId, isPengasuh } = payload;
    if (role === 'guru' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, tindakan_kebersihan, kondisi_akhir, petugas_id } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Get laporan info
    const [laporanRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM laporan_kebersihan WHERE id = ?', [id]
    );
    if (laporanRows.length === 0) return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
    const laporan = laporanRows[0];

    const tanggalSelesai = status === 'Selesai' ? new Date() : null;
    const petugasVal = petugas_id || laporan.petugas_id || userId;

    await pool.execute(
      'UPDATE laporan_kebersihan SET status = ?, tindakan_kebersihan = ?, tanggal_selesai = ?, petugas_id = ? WHERE id = ?',
      [status, tindakan_kebersihan || laporan.tindakan_kebersihan, tanggalSelesai, petugasVal, id]
    );

    // Jika selesai, update kondisi kebersihan kembali ke kondisi akhir yang dipilih
    if (status === 'Selesai' && kondisi_akhir) {
      await pool.execute(
        'UPDATE kebersihan SET kondisi = ? WHERE id = ?',
        [kondisi_akhir, laporan.kebersihan_id]
      );
    }

    return NextResponse.json({ success: true, message: 'Status laporan berhasil diperbarui' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
