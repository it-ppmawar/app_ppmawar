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
    const allowedRoles = ['admin', 'staff', 'petugas_sarpras', 'pengurus_asrama', 'pengasuh'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterAsrama = searchParams.get('asrama');
    const filterKategori = searchParams.get('kategori');
    const filterKondisi = searchParams.get('kondisi');

    let whereClause = 'WHERE 1=1';
    let params: any[] = [];

    // Jika pengurus asrama, batasi hanya asramanya sendiri
    if (role === 'pengurus_asrama') {
      const myAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);
      if (!myAsrama) {
        return NextResponse.json({ error: 'Asrama tidak ditemukan untuk akun ini' }, { status: 403 });
      }
      // asrama string in db usually "A", "B", "Tahfid", or "Asrama A" etc.
      whereClause += ' AND (i.asrama = ? OR i.asrama = ?)';
      params.push(myAsrama, myAsrama.replace('Asrama ', ''));
    } else if (filterAsrama) {
      whereClause += ' AND (i.asrama = ? OR i.asrama = ?)';
      params.push(filterAsrama, filterAsrama.replace('Asrama ', ''));
    }

    if (filterKategori) {
      whereClause += ' AND i.kategori = ?';
      params.push(filterKategori);
    }
    
    if (filterKondisi) {
      whereClause += ' AND i.kondisi = ?';
      params.push(filterKondisi);
    }

    const query = `
      SELECT i.*, 
             k.nama_kamar,
             (SELECT COUNT(*) FROM laporan_kerusakan l WHERE l.inventaris_id = i.id AND l.status != 'Selesai' AND l.status != 'Dibatalkan') as laporan_aktif
      FROM inventaris i
      LEFT JOIN kamar k ON i.kamar_id = k.kamar_id
      ${whereClause}
      ORDER BY i.asrama ASC, i.nama_barang ASC
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('API /inventaris GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) as any : null;
    
    // HANYA Admin dan Staff yang boleh menambah inventaris baru
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Hanya admin dan staff yang dapat menambahkan data inventaris' }, { status: 403 });
    }

    const data = await request.json();
    const { nama_barang, kategori, asrama, kamar_id, jumlah, kondisi, keterangan } = data;
    
    if (!nama_barang || !kategori || !asrama) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    await pool.execute(
      `INSERT INTO inventaris (nama_barang, kategori, asrama, kamar_id, jumlah, kondisi, keterangan)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nama_barang, kategori, asrama, kamar_id || null, jumlah || 1, kondisi || 'Baik', keterangan || null]
    );

    return NextResponse.json({ success: true, message: 'Data inventaris berhasil ditambahkan' });
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
    // Boleh Edit: Admin, Staff, Petugas Sarpras, Pengurus Asrama
    if (!['admin', 'staff', 'petugas_sarpras', 'pengurus_asrama'].includes(role)) {
      return NextResponse.json({ error: 'Akses edit ditolak' }, { status: 403 });
    }

    const data = await request.json();
    const { id, nama_barang, kategori, asrama, kamar_id, jumlah, kondisi, keterangan } = data;
    
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    if (role === 'pengurus_asrama') {
      const myAsrama = await resolveAsrama(payload.userId, role, payload.username || '', payload.namaAsrama || null);
      // Cek apakah item ini milik asramanya
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT asrama FROM inventaris WHERE id = ?`, [id]);
      if (rows.length === 0) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
      
      const itemAsrama = rows[0].asrama;
      if (itemAsrama !== myAsrama && itemAsrama !== myAsrama?.replace('Asrama ', '')) {
        return NextResponse.json({ error: 'Anda hanya dapat mengedit inventaris asrama Anda sendiri' }, { status: 403 });
      }
    }

    await pool.execute(
      `UPDATE inventaris SET 
        nama_barang = ?, 
        kategori = ?, 
        asrama = ?, 
        kamar_id = ?, 
        jumlah = ?, 
        kondisi = ?, 
        keterangan = ?
       WHERE id = ?`,
      [nama_barang, kategori, asrama, kamar_id || null, jumlah || 1, kondisi, keterangan || null, id]
    );

    return NextResponse.json({ success: true, message: 'Data inventaris berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) as any : null;
    
    // HANYA Admin dan Staff yang boleh menghapus
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Hanya admin dan staff yang dapat menghapus data inventaris' }, { status: 403 });
    }

    const data = await request.json();
    const { id } = data;
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    await pool.execute('DELETE FROM inventaris WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Data inventaris berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
