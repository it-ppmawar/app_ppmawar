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

    const { role, guruId, muridId, userId, username } = payload;
    const tokenAsrama = payload.namaAsrama || null;

    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);
    
    const { searchParams } = new URL(request.url);
    const filterMadin = searchParams.get('kelas_madin_id');
    const filterQuran = searchParams.get('kelas_quran_id');
    const filterKamar = searchParams.get('kamar_id');
    const tanpaMadin = searchParams.get('tanpa_madin') === '1';
    const tanpaQuran = searchParams.get('tanpa_quran') === '1';
    const tanpaKamar = searchParams.get('tanpa_kamar') === '1';

    let whereClause = '1=1';
    let queryParams: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        // Guru melihat murid yang ada di kelas/kamarnya
        whereClause = `
          (m.kelas_madin_id IN (SELECT kelas_id FROM kelas_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT id FROM kelas_quran WHERE guru_id = ?)
          OR m.kamar_id IN (SELECT kamar_id FROM kamar WHERE guru_id = ?)
          OR m.kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?))
        `;
        queryParams = [guruId, guruId, guruId, guruId, guruId];
      } else {
        whereClause = '0=1';
      }
    } else if (role === 'pengurus_asrama' || role === 'pengasuh') {
      if (namaAsrama) {
        if (role === 'pengasuh') {
          // Pengasuh hanya dapat melihat santri di asramanya sendiri (pesantren saja)
          whereClause = `m.kamar_id IN (SELECT kamar_id FROM kamar WHERE nama_asrama = ?)`;
          queryParams = [namaAsrama];
        } else {
          // Tentukan jenis kelamin target berdasarkan nama asrama
          let targetGender: string | null = null;
          const asramaLower = namaAsrama.toLowerCase();
          if (asramaLower.includes('asrama a') || asramaLower === 'a') {
            targetGender = 'Laki-laki';
          } else if (
            asramaLower.includes('asrama b') ||
            asramaLower.includes('asrama c') ||
            asramaLower.includes('asrama d') ||
            asramaLower.includes('asrama e') ||
            asramaLower.includes('asrama f') ||
            ['b', 'c', 'd', 'e', 'f'].includes(asramaLower.trim())
          ) {
            targetGender = 'Perempuan';
          }

          // Pengurus asrama melihat santri di asramanya sendiri, ATAU santri lintas asrama yang terdaftar di kelas Qur'an yang diikuti oleh santri dari asramanya,
          // ATAU santri yang belum terpetakan (kamar, madin, atau quran) yang berjenis kelamin sesuai gender target asrama
          whereClause = `(
            m.kamar_id IN (SELECT kamar_id FROM kamar WHERE nama_asrama = ?)
            OR m.kelas_quran_id IN (
              SELECT DISTINCT m2.kelas_quran_id 
              FROM murid m2 
              JOIN kamar km2 ON m2.kamar_id = km2.kamar_id 
              WHERE km2.nama_asrama = ? AND m2.kelas_quran_id IS NOT NULL
            )
            OR m.kelas_quran_id IN (
              SELECT id FROM kelas_quran WHERE nama_kelas LIKE ?
            )
            ${targetGender ? 'OR ((m.kamar_id IS NULL OR m.kelas_madin_id IS NULL OR m.kelas_quran_id IS NULL) AND m.jenis_kelamin = ?)' : ''}
          )`;
          queryParams = [namaAsrama, namaAsrama, `%${namaAsrama}%`];
          if (targetGender) {
            queryParams.push(targetGender);
          }
        }
      } else {
        whereClause = '0=1';
      }
    } else if (role !== 'admin' && role !== 'staff') {
      // Wali murid
      if (muridId) {
        whereClause = `m.murid_id = ?`;
        queryParams = [muridId];
      } else {
        whereClause = '0=1';
      }
    }

    if (filterMadin) {
      whereClause += ` AND m.kelas_madin_id = ?`;
      queryParams.push(filterMadin);
    }
    if (filterQuran) {
      whereClause += ` AND m.kelas_quran_id = ?`;
      queryParams.push(filterQuran);
    }
    if (filterKamar) {
      whereClause += ` AND m.kamar_id = ?`;
      queryParams.push(filterKamar);
    }
    // Filter santri yang belum punya kelas/kamar (untuk fitur tambah santri)
    if (tanpaMadin) {
      whereClause += ` AND m.kelas_madin_id IS NULL`;
    }
    if (tanpaQuran) {
      whereClause += ` AND m.kelas_quran_id IS NULL`;
    }
    if (tanpaKamar) {
      whereClause += ` AND m.kamar_id IS NULL`;
    }

    const sql = `
      SELECT m.*,
             km.nama_kelas as kelas_madin, 
             kq.nama_kelas as kelas_quran,
             k.nama_kamar
      FROM murid m
      LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
      LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
      LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
      WHERE ${whereClause}
      ORDER BY m.nama ASC
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(sql, queryParams);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error API Murid:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    const allowedRoles = ['admin', 'staff', 'guru', 'pengurus_asrama', 'pengasuh'];
    if (!payload || !allowedRoles.includes((payload as any).role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { role, namaAsrama } = payload as any;

    const data = await request.json();
    const { 
      murid_id, murid_ids, 
      kelas_madin_id, kelas_quran_id, kamar_id,
      nama, nama_panggilan, nis, nik, no_hp, alamat, nama_wali, no_wali, nilai, foto, barcode_id, jenis_kelamin
    } = data;

    const idsToUpdate = murid_ids || (murid_id ? [murid_id] : []);
    if (idsToUpdate.length === 0) return NextResponse.json({ error: 'ID Murid tidak valid' }, { status: 400 });

    if (role === 'pengurus_asrama' || role === 'pengasuh') {
      if (!namaAsrama) {
        return NextResponse.json({ error: 'Akses ditolak: Asrama Anda tidak terdefinisi' }, { status: 403 });
      }

      // Ambil murid yang tidak termasuk dalam hak akses pengurus asrama ini
      const placeholders = idsToUpdate.map(() => '?').join(',');
      const [inaccessible] = await pool.execute<RowDataPacket[]>(
        `SELECT murid_id FROM murid 
         WHERE murid_id IN (${placeholders})
         AND kamar_id NOT IN (SELECT kamar_id FROM kamar WHERE nama_asrama = ?)
         AND (
           kelas_quran_id IS NULL OR (
             kelas_quran_id NOT IN (
               SELECT DISTINCT m2.kelas_quran_id 
               FROM murid m2 
               JOIN kamar km2 ON m2.kamar_id = km2.kamar_id 
               WHERE km2.nama_asrama = ? AND m2.kelas_quran_id IS NOT NULL
             )
             AND
             kelas_quran_id NOT IN (
               SELECT id FROM kelas_quran WHERE nama_kelas LIKE ?
             )
           )
         )`,
        [...idsToUpdate, namaAsrama, namaAsrama, `%${namaAsrama}%`]
      );
      
      if (inaccessible.length > 0) {
        return NextResponse.json({ error: 'Akses ditolak: Anda tidak memiliki hak akses untuk mengedit sebagian atau seluruh santri yang dipilih' }, { status: 403 });
      }
    }

    let updates: string[] = [];
    let params: any[] = [];
    
    // Helper function to append fields
    const appendUpdate = (key: string, value: any) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    };

    appendUpdate('kelas_madin_id', kelas_madin_id === '' ? null : kelas_madin_id);
    appendUpdate('kelas_quran_id', kelas_quran_id === '' ? null : kelas_quran_id);
    appendUpdate('kamar_id', kamar_id === '' ? null : kamar_id);
    appendUpdate('nama', nama);
    appendUpdate('nama_panggilan', nama_panggilan);
    appendUpdate('nis', nis);
    appendUpdate('nik', nik);
    appendUpdate('barcode_id', barcode_id);
    appendUpdate('no_hp', no_hp);
    appendUpdate('alamat', alamat);
    appendUpdate('nama_wali', nama_wali);
    appendUpdate('no_wali', no_wali);
    appendUpdate('nilai', nilai);
    appendUpdate('foto', foto);
    appendUpdate('jenis_kelamin', jenis_kelamin);

    if (updates.length > 0) {
      const placeholders = idsToUpdate.map(() => '?').join(',');
      params.push(...idsToUpdate);
      
      const query = `UPDATE murid SET ${updates.join(', ')} WHERE murid_id IN (${placeholders})`;
      await pool.execute(query, params);
    }

    return NextResponse.json({ success: true, message: 'Data murid diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
