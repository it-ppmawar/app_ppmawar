import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, userId, username } = payload as any;
    const tokenAsrama = (payload as any).namaAsrama || null;

    let query = `SELECT guru_id, nip, nama, jenis_kelamin, jabatan, alamat, no_hp as whatsapp, foto FROM guru`;
    let params: any[] = [];

    if (role === 'guru') {
      const guruId = (payload as any).guruId;
      if (guruId) {
        query += ` WHERE guru_id = ?`;
        params.push(guruId);
      } else {
        query += ` WHERE 0=1`;
      }
    } else if (role === 'pengurus_asrama' || role === 'pengasuh') {
      // Pengurus asrama melihat seluruh pembina kamar (guru) yang bertugas di asramanya
      const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
      const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);
      if (namaAsrama) {
        query += ` WHERE guru_id IN (
          SELECT guru_id FROM kamar
          WHERE nama_asrama = ? AND guru_id IS NOT NULL
        )`;
        params.push(namaAsrama);
      } else {
        query += ` WHERE 0=1`;
      }
    } else if (role !== 'admin' && role !== 'staff') {
      // Wali murid — hanya melihat guru yang terkait dengan santrinya
      const muridId = (payload as any).muridId;
      if (muridId) {
        query += ` WHERE guru_id IN (
          SELECT guru_id FROM kamar WHERE kamar_id = (SELECT kamar_id FROM murid WHERE murid_id = ?) AND guru_id IS NOT NULL
          UNION
          SELECT guru_id FROM kelas_madin WHERE kelas_id = (SELECT kelas_madin_id FROM murid WHERE murid_id = ?) AND guru_id IS NOT NULL
          UNION
          SELECT guru_id FROM kelas_quran WHERE id = (SELECT kelas_quran_id FROM murid WHERE murid_id = ?) AND guru_id IS NOT NULL
          UNION
          SELECT guru_id FROM jadwal_madin WHERE kelas_madin_id = (SELECT kelas_madin_id FROM murid WHERE murid_id = ?) AND guru_id IS NOT NULL
          UNION
          SELECT guru_id FROM jadwal_quran WHERE kelas_quran_id = (SELECT kelas_quran_id FROM murid WHERE murid_id = ?) AND guru_id IS NOT NULL
          UNION
          SELECT guru_id FROM jadwal_kegiatan WHERE kamar_id = (SELECT kamar_id FROM murid WHERE murid_id = ?) AND guru_id IS NOT NULL
        )`;
        params.push(muridId, muridId, muridId, muridId, muridId, muridId);
      } else {
        query += ` WHERE 0=1`;
      }
    }

    query += ` ORDER BY nama ASC`;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);

    // Fetch kelas/kamar per guru (biar tidak 1-1, kita ambil semua lalu petakan)
    const [madinRows] = await pool.execute<RowDataPacket[]>('SELECT guru_id, nama_kelas FROM kelas_madin WHERE guru_id IS NOT NULL');
    const [quranRows] = await pool.execute<RowDataPacket[]>('SELECT guru_id, nama_kelas FROM kelas_quran WHERE guru_id IS NOT NULL');
    const [kamarRows] = await pool.execute<RowDataPacket[]>('SELECT guru_id, nama_kamar FROM kamar WHERE guru_id IS NOT NULL');

    const guruWithDetails = rows.map(guru => {
      return {
        ...guru,
        kelas_madin: madinRows.filter(m => m.guru_id === guru.guru_id).map(m => m.nama_kelas),
        kelas_quran: quranRows.filter(q => q.guru_id === guru.guru_id).map(q => q.nama_kelas),
        kamar: kamarRows.filter(k => k.guru_id === guru.guru_id).map(k => k.nama_kamar),
      };
    });

    return NextResponse.json({ success: true, data: guruWithDetails });
  } catch (error: any) {
    console.error('Error API Guru:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    if (!payload || !['admin', 'staff'].includes((payload as any).role)) {
      return NextResponse.json({ error: 'Hanya admin/staff yang dapat menambah data' }, { status: 403 });
    }

    const data = await request.json();
    const { nip, nama, jenis_kelamin, jabatan, alamat, whatsapp, foto } = data;

    if (!nama) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    }

    const sql = `
      INSERT INTO guru (nip, nama, jenis_kelamin, jabatan, alamat, no_hp, foto)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      nip || null,
      nama,
      jenis_kelamin || 'LAKI-LAKI',
      jabatan || null,
      alamat || null,
      whatsapp || null,
      foto || null
    ];

    const [result] = await pool.execute(sql, params);
    return NextResponse.json({ success: true, message: 'Data guru berhasil ditambahkan', insertId: (result as any).insertId });
  } catch (error: any) {
    console.error('Error POST /api/guru:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    if (!payload || (payload as any).role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat menghapus' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    await pool.execute('DELETE FROM guru WHERE guru_id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Data guru dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, guruId: loggedInGuruId } = payload as any;
    const data = await request.json();
    const { guru_id, nama, jenis_kelamin, jabatan, alamat, whatsapp, foto } = data;

    if (!guru_id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    // Cek izin: Admin/Staff bebas, Guru hanya bisa edit datanya sendiri
    if (role === 'guru' && parseInt(loggedInGuruId) !== parseInt(guru_id)) {
      return NextResponse.json({ error: 'Anda hanya dapat mengubah data Anda sendiri' }, { status: 403 });
    } else if (role !== 'admin' && role !== 'staff' && role !== 'guru') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    let updates = [];
    let params = [];
    
    if (nama !== undefined) { updates.push('nama = ?'); params.push(nama); }
    if (jenis_kelamin !== undefined) { updates.push('jenis_kelamin = ?'); params.push(jenis_kelamin); }
    if (jabatan !== undefined) { updates.push('jabatan = ?'); params.push(jabatan); }
    if (alamat !== undefined) { updates.push('alamat = ?'); params.push(alamat); }
    if (whatsapp !== undefined) { updates.push('no_hp = ?'); params.push(whatsapp); }
    if (foto !== undefined) { updates.push('foto = ?'); params.push(foto); }

    if (updates.length > 0) {
      params.push(guru_id);
      await pool.execute(`UPDATE guru SET ${updates.join(', ')} WHERE guru_id = ?`, params);
    }

    return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
