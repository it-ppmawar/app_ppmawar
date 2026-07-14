import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { resolveAsrama } from '@/lib/auth/resolveAsrama';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, userId, username } = payload;
    const tokenAsrama = payload.namaAsrama || null;

    // Cek akses
    const allowedRoles = ['admin', 'staff', 'petugas_sarpras', 'pengurus_asrama'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get('status');

    let whereClause = 'WHERE 1=1';
    let params: any[] = [];

    // Jika pengurus asrama, batasi hanya laporan dari barang di asramanya sendiri
    if (role === 'pengurus_asrama') {
      const myAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);
      if (!myAsrama) {
        return NextResponse.json({ error: 'Asrama tidak ditemukan untuk akun ini' }, { status: 403 });
      }
      whereClause += ' AND (i.asrama = ? OR i.asrama = ?)';
      params.push(myAsrama, myAsrama.replace('Asrama ', ''));
    }

    if (filterStatus) {
      whereClause += ' AND l.status = ?';
      params.push(filterStatus);
    }

    const query = `
      SELECT l.*, 
             i.nama_barang, i.asrama, i.kategori,
             p.nama as nama_pelapor,
             ptg.nama as nama_petugas
      FROM laporan_kerusakan l
      JOIN inventaris i ON l.inventaris_id = i.id
      JOIN users p ON l.pelapor_id = p.id
      LEFT JOIN users ptg ON l.petugas_id = ptg.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN l.status = 'Dilaporkan' THEN 1
          WHEN l.status = 'Diproses' THEN 2
          ELSE 3
        END,
        l.created_at DESC
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('API /inventaris/laporan GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) as any : null;
    
    // HANYA Admin, Staff, Petugas Sarpras, dan Pengurus Asrama yang boleh melaporkan
    if (!payload || !['admin', 'staff', 'petugas_sarpras', 'pengurus_asrama'].includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { userId, role, username, namaAsrama } = payload;
    const data = await request.json();
    const { inventaris_id, deskripsi_masalah } = data;
    
    if (!inventaris_id || !deskripsi_masalah) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    if (role === 'pengurus_asrama') {
      const myAsrama = await resolveAsrama(userId, role, username || '', namaAsrama || null);
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT asrama FROM inventaris WHERE id = ?`, [inventaris_id]);
      if (rows.length === 0) return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 404 });
      
      const itemAsrama = rows[0].asrama;
      if (itemAsrama !== myAsrama && itemAsrama !== myAsrama?.replace('Asrama ', '')) {
        return NextResponse.json({ error: 'Anda hanya dapat melaporkan barang di asrama Anda sendiri' }, { status: 403 });
      }
    }

    // Ubah kondisi barang menjadi Rusak Ringan secara default ketika dilaporkan, kecuali jika di-override nanti
    await pool.execute('UPDATE inventaris SET kondisi = ? WHERE id = ?', ['Rusak Ringan', inventaris_id]);

    await pool.execute(
      `INSERT INTO laporan_kerusakan (inventaris_id, pelapor_id, deskripsi_masalah)
       VALUES (?, ?, ?)`,
      [inventaris_id, userId, deskripsi_masalah]
    );

    return NextResponse.json({ success: true, message: 'Laporan kerusakan berhasil dikirim' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) as any : null;
    
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const role = payload.role;
    // Boleh Edit Status Laporan: Admin, Staff, Petugas Sarpras
    if (!['admin', 'staff', 'petugas_sarpras'].includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak, Anda bukan petugas perbaikan/admin' }, { status: 403 });
    }

    const data = await request.json();
    const { id, status, tindakan_perbaikan, kondisi_akhir } = data;
    
    if (!id || !status) return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });

    const petugas_id = payload.userId;

    let query = \`UPDATE laporan_kerusakan SET status = ?, petugas_id = ?\`;
    let params: any[] = [status, petugas_id];

    if (tindakan_perbaikan !== undefined) {
      query += \`, tindakan_perbaikan = ?\`;
      params.push(tindakan_perbaikan);
    }

    if (status === 'Selesai') {
      query += \`, tanggal_selesai = CURRENT_TIMESTAMP\`;
    }

    query += \` WHERE id = ?\`;
    params.push(id);

    await pool.execute(query, params);

    // Jika status Selesai, dan ada kondisi_akhir, update inventaris
    if (status === 'Selesai' && kondisi_akhir) {
       const [laporanRows] = await pool.execute<RowDataPacket[]>('SELECT inventaris_id FROM laporan_kerusakan WHERE id = ?', [id]);
       if (laporanRows.length > 0) {
          const invId = laporanRows[0].inventaris_id;
          await pool.execute('UPDATE inventaris SET kondisi = ? WHERE id = ?', [kondisi_akhir, invId]);
       }
    }

    return NextResponse.json({ success: true, message: 'Status laporan berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
