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

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, muridId } = payload as any;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'alpa';
    
    // Konfigurasi hak akses berbasis role
    let muridFilter = '1=1';
    let queryParams: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        muridFilter = `
          m.kelas_madin_id IN (SELECT kelas_id FROM kelas_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT id FROM kelas_quran WHERE guru_id = ?)
          OR m.kamar_id IN (SELECT kamar_id FROM kamar WHERE guru_id = ?)
          OR m.kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?)
        `;
        queryParams = [guruId, guruId, guruId, guruId, guruId];
      } else {
        muridFilter = '0=1';
      }
    } else if (role === 'pengurus_asrama') {
      // Resolve nama asrama untuk pengurus
      const { userId, username } = payload as any;
      const tokenAsrama = (payload as any).namaAsrama || null;
      const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
      const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

      if (namaAsrama) {
        // Tampilkan ketertiban santri yang kamarnya ada di asramanya
        muridFilter = `m.kamar_id IN (SELECT kamar_id FROM kamar WHERE nama_asrama = ?)`;
        queryParams = [namaAsrama];
      } else {
        muridFilter = '0=1';
      }
    } else if (role !== 'admin' && role !== 'staff') {
      if (muridId) {
        muridFilter = `m.murid_id = ?`;
        queryParams = [muridId];
      } else {
        muridFilter = '0=1';
      }
    }

    if (tab === 'alpa') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.pelanggaran_id as id, m.nama as nama, m.jenis_kelamin as jenis_kelamin,
                p.tanggal, p.deskripsi as keterangan, p.jenis as status 
         FROM pelanggaran p
         JOIN murid m ON p.murid_id = m.murid_id
         WHERE (p.jenis LIKE '%Alpa%' OR p.jenis LIKE '%Hadir%' OR p.jenis LIKE '%Izin%' OR p.jenis LIKE '%Sakit%')
           AND (${muridFilter})
         ORDER BY p.tanggal DESC
         LIMIT 50`,
         queryParams
      );
      
      const dataAlpa = rows.map(r => ({
        id: r.id,
        nama: r.nama,
        jenis_kelamin: r.jenis_kelamin || '-',
        kelas: '-',
        tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        raw_tanggal: r.tanggal,
        keterangan: r.keterangan || r.status,
        ditindak: true
      }));

      return NextResponse.json({ success: true, data: dataAlpa });
    } else {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.pelanggaran_id as id, m.nama as nama, m.jenis_kelamin as jenis_kelamin,
                p.tanggal, p.jenis as jenis, p.deskripsi
         FROM pelanggaran p
         JOIN murid m ON p.murid_id = m.murid_id
         WHERE p.jenis NOT LIKE '%Alpa%' AND p.jenis NOT LIKE '%Hadir%' AND p.jenis NOT LIKE '%Izin%' AND p.jenis NOT LIKE '%Sakit%'
           AND (${muridFilter})
         ORDER BY p.tanggal DESC
         LIMIT 50`,
         queryParams
      );

      const dataPelanggaran = rows.map(r => ({
        id: r.id,
        nama: r.nama,
        jenis_kelamin: r.jenis_kelamin || '-',
        kelas: '-',
        tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        raw_tanggal: r.tanggal,
        jenis: r.jenis,
        poin: 0,
        ditindak: true
      }));

      return NextResponse.json({ success: true, data: dataPelanggaran });
    }
  } catch (error: any) {
    console.error('Error API Ketertiban:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    await pool.execute('DELETE FROM pelanggaran WHERE pelanggaran_id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
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
    const allowed = ['admin', 'staff', 'pengurus_asrama', 'guru'];
    if (!allowed.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { murid_id, jenis, deskripsi, tanggal } = body;

    if (!murid_id || !jenis || !tanggal) {
      return NextResponse.json({ error: 'Field murid_id, jenis, dan tanggal wajib diisi' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO pelanggaran (murid_id, jenis, deskripsi, tanggal) VALUES (?, ?, ?, ?)',
      [murid_id, jenis, deskripsi || '', tanggal]
    );

    return NextResponse.json({ success: true, message: 'Data pelanggaran berhasil ditambahkan' });
  } catch (error: any) {
    console.error('POST Ketertiban Error:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload as any;
    const allowed = ['admin', 'staff', 'pengurus_asrama', 'guru'];
    if (!allowed.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { id, jenis, deskripsi, tanggal } = body;
    
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    await pool.execute(
      'UPDATE pelanggaran SET jenis = ?, deskripsi = ?, tanggal = ? WHERE pelanggaran_id = ?',
      [jenis, deskripsi, tanggal, id]
    );
    return NextResponse.json({ success: true, message: 'Data berhasil diubah' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
