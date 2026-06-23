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

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, muridId, userId, username } = payload;
    const tokenAsrama = payload.namaAsrama || null;

    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

    let whereClauseMadin = '1=1';
    let whereClauseQuran = '1=1';
    let whereClauseKegiatan = '1=1';
    let paramsMadin: any[] = [];
    let paramsQuran: any[] = [];
    let paramsKegiatan: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        whereClauseMadin = 'j.guru_id = ?';
        whereClauseQuran = 'j.guru_id = ?';
        whereClauseKegiatan = 'j.guru_id = ?';
        paramsMadin = [guruId];
        paramsQuran = [guruId];
        paramsKegiatan = [guruId];
      } else {
        whereClauseMadin = '0=1';
        whereClauseQuran = '0=1';
        whereClauseKegiatan = '0=1';
      }
    } else if (role === 'pengurus_asrama') {
      if (namaAsrama) {
        // Jadwal Madin: kelas yang ada santri dari asrama ini
        whereClauseMadin = `j.kelas_madin_id IN (
          SELECT DISTINCT m.kelas_madin_id FROM murid m
          JOIN kamar km ON m.kamar_id = km.kamar_id
          WHERE km.nama_asrama = ? AND m.kelas_madin_id IS NOT NULL
        )`;
        // Jadwal Quran: kelas yang ada santri dari asrama ini OR nama_kelas mengandung nama asrama
        whereClauseQuran = `(
          j.kelas_quran_id IN (
            SELECT DISTINCT m.kelas_quran_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
          )
          OR
          j.kelas_quran_id IN (
            SELECT id FROM kelas_quran WHERE nama_kelas LIKE ?
          )
        )`;
        // Kegiatan: kamar yang masuk asrama ini
        whereClauseKegiatan = `j.kamar_id IN (
          SELECT kamar_id FROM kamar WHERE nama_asrama = ?
        )`;
        paramsMadin = [namaAsrama];
        paramsQuran = [namaAsrama, `%${namaAsrama}%`];
        paramsKegiatan = [namaAsrama];
      } else {
        whereClauseMadin = '0=1';
        whereClauseQuran = '0=1';
        whereClauseKegiatan = '0=1';
      }
    } else if (role !== 'admin' && role !== 'staff') {
      // Wali murid
      if (muridId) {
        whereClauseMadin = 'j.kelas_madin_id = (SELECT kelas_madin_id FROM murid WHERE murid_id = ? LIMIT 1)';
        whereClauseQuran = 'j.kelas_quran_id = (SELECT kelas_quran_id FROM murid WHERE murid_id = ? LIMIT 1)';
        whereClauseKegiatan = 'j.kamar_id = (SELECT kamar_id FROM murid WHERE murid_id = ? LIMIT 1)';
        paramsMadin = [muridId];
        paramsQuran = [muridId];
        paramsKegiatan = [muridId];
      } else {
        whereClauseMadin = '0=1';
        whereClauseQuran = '0=1';
        whereClauseKegiatan = '0=1';
      }
    }

    const [jadwalMadin] = await pool.execute<RowDataPacket[]>(
      `SELECT j.jadwal_id as id, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran as kegiatan, 
              k.nama_kelas as tempat, j.kelas_madin_id as tempat_id, g.nama as guru, j.guru_id, 'madin' as tipe
       FROM jadwal_madin j
       LEFT JOIN kelas_madin k ON j.kelas_madin_id = k.kelas_id
       LEFT JOIN guru g ON j.guru_id = g.guru_id
       WHERE ${whereClauseMadin}
       ORDER BY j.hari, j.jam_mulai`,
       paramsMadin
    );

    const [jadwalQuran] = await pool.execute<RowDataPacket[]>(
      `SELECT j.id, j.hari, j.jam_mulai, j.jam_selesai, j.mata_pelajaran as kegiatan, 
              k.nama_kelas as tempat, j.kelas_quran_id as tempat_id, g.nama as guru, j.guru_id, 'quran' as tipe
       FROM jadwal_quran j
       LEFT JOIN kelas_quran k ON j.kelas_quran_id = k.id
       LEFT JOIN guru g ON j.guru_id = g.guru_id
       WHERE ${whereClauseQuran}
       ORDER BY j.hari, j.jam_mulai`,
       paramsQuran
    );

    const [jadwalKegiatan] = await pool.execute<RowDataPacket[]>(
      `SELECT j.kegiatan_id as id, j.hari, j.jam_mulai, j.jam_selesai, j.nama_kegiatan as kegiatan, 
              k.nama_kamar as tempat, j.kamar_id as tempat_id, g.nama as guru, j.guru_id, 'kegiatan' as tipe
       FROM jadwal_kegiatan j
       LEFT JOIN kamar k ON j.kamar_id = k.kamar_id
       LEFT JOIN guru g ON j.guru_id = g.guru_id
       WHERE ${whereClauseKegiatan}
       ORDER BY j.hari, j.jam_mulai`,
       paramsKegiatan
    );

    const allJadwal = [...jadwalMadin, ...jadwalQuran, ...jadwalKegiatan];

    return NextResponse.json({ success: true, data: allJadwal });
  } catch (error: any) {
    console.error('Error API Jadwal:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role } = payload;
    // Ambil body lebih awal untuk cek tipe
    const body = await request.json();
    const { ids, tipe, hari, jam_mulai, jam_selesai, kegiatan, tempat_id, guru_id } = body;

    // Hanya admin/staff yang boleh mengedit jadwal
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff yang dapat mengedit jadwal' }, { status: 403 });
    }
    
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !tipe) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    let query = '';
    let params: any[] = [];
    let updates: string[] = [];

    if (hari) { updates.push('hari = ?'); params.push(hari); }
    if (jam_mulai) { updates.push('jam_mulai = ?'); params.push(jam_mulai); }
    if (jam_selesai) { updates.push('jam_selesai = ?'); params.push(jam_selesai); }
    
    if (tipe === 'madin') {
      if (kegiatan) { updates.push('mata_pelajaran = ?'); params.push(kegiatan); }
      if (tempat_id) { updates.push('kelas_madin_id = ?'); params.push(tempat_id); }
      if (guru_id) { updates.push('guru_id = ?'); params.push(guru_id); }
      query = `UPDATE jadwal_madin SET ${updates.join(', ')} WHERE jadwal_id IN (${ids.map(() => '?').join(',')})`;
    } else if (tipe === 'quran') {
      if (kegiatan) { updates.push('mata_pelajaran = ?'); params.push(kegiatan); }
      if (tempat_id) { updates.push('kelas_quran_id = ?'); params.push(tempat_id); }
      if (guru_id) { updates.push('guru_id = ?'); params.push(guru_id); }
      query = `UPDATE jadwal_quran SET ${updates.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`;
    } else if (tipe === 'kegiatan') {
      if (kegiatan) { updates.push('nama_kegiatan = ?'); params.push(kegiatan); }
      if (tempat_id) { updates.push('kamar_id = ?'); params.push(tempat_id); }
      if (guru_id) { updates.push('guru_id = ?'); params.push(guru_id); }
      query = `UPDATE jadwal_kegiatan SET ${updates.join(', ')} WHERE kegiatan_id IN (${ids.map(() => '?').join(',')})`;
    }

    if (updates.length > 0) {
      params.push(...ids);
      await pool.execute(query, params);
    }

    return NextResponse.json({ success: true, message: 'Jadwal berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tipe, hari, jam_mulai, jam_selesai, kegiatan, tempat_id, guru_id } = body;
    
    if (!tipe || !hari || !jam_mulai || !jam_selesai || !kegiatan || !tempat_id) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    let query = '';
    let params: any[] = [];

    if (tipe === 'madin') {
      query = `INSERT INTO jadwal_madin (hari, jam_mulai, jam_selesai, mata_pelajaran, kelas_madin_id, guru_id) VALUES (?, ?, ?, ?, ?, ?)`;
      params = [hari, jam_mulai, jam_selesai, kegiatan, tempat_id, guru_id || null];
    } else if (tipe === 'quran') {
      query = `INSERT INTO jadwal_quran (hari, jam_mulai, jam_selesai, mata_pelajaran, kelas_quran_id, guru_id) VALUES (?, ?, ?, ?, ?, ?)`;
      params = [hari, jam_mulai, jam_selesai, kegiatan, tempat_id, guru_id || null];
    } else if (tipe === 'kegiatan') {
      query = `INSERT INTO jadwal_kegiatan (hari, jam_mulai, jam_selesai, nama_kegiatan, kamar_id, guru_id) VALUES (?, ?, ?, ?, ?, ?)`;
      params = [hari, jam_mulai, jam_selesai, kegiatan, tempat_id, guru_id || null];
    }

    await pool.execute(query, params);

    return NextResponse.json({ success: true, message: 'Jadwal berhasil ditambahkan' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
