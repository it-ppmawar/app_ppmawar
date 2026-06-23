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
    const type = searchParams.get('type'); // madin | quran | kamar
    
    if (!type || !['madin', 'quran', 'kamar', 'kegiatan', 'guru'].includes(type)) {
      return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
    }

    const actualType = type === 'kegiatan' ? 'kamar' : type;

    let whereClause = '';
    let params: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        if (actualType === 'madin') {
          whereClause = `WHERE k.guru_id = ? OR k.kelas_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)`;
          params = [guruId, guruId];
        } else if (actualType === 'quran') {
          whereClause = `WHERE k.guru_id = ? OR k.id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?)`;
          params = [guruId, guruId];
        } else if (actualType === 'kamar') {
          whereClause = `WHERE k.guru_id = ? OR k.kamar_id IN (SELECT kamar_id FROM jadwal_kegiatan WHERE guru_id = ?)`;
          params = [guruId, guruId];
        }
      } else {
        whereClause = `WHERE 0=1`;
      }
    } else if (role === 'pengurus_asrama') {
      if (namaAsrama) {
        if (actualType === 'madin') {
          whereClause = `WHERE k.kelas_id IN (SELECT DISTINCT m.kelas_madin_id FROM murid m JOIN kamar km ON m.kamar_id = km.kamar_id WHERE km.nama_asrama = ? AND m.kelas_madin_id IS NOT NULL)`;
          params = [namaAsrama];
        } else if (actualType === 'quran') {
          // Pengurus asrama hanya dapat melihat kelas quran yang ada santri dari asramanya ATAU nama_kelas mengandung nama asrama
          whereClause = `WHERE k.id IN (
            SELECT DISTINCT m.kelas_quran_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
          ) OR k.nama_kelas LIKE ?`;
          params = [namaAsrama, `%${namaAsrama}%`];
        } else if (actualType === 'kamar') {
          whereClause = `WHERE k.nama_asrama = ?`;
          params = [namaAsrama];
        }
      } else {
        whereClause = `WHERE 0=1`;
      }
    } else if (role !== 'admin' && role !== 'staff') {
      if (muridId) {
        if (actualType === 'madin') {
          whereClause = `WHERE k.kelas_id = (SELECT kelas_madin_id FROM murid WHERE murid_id = ? LIMIT 1)`;
          params = [muridId];
        } else if (actualType === 'quran') {
          whereClause = `WHERE k.id = (SELECT kelas_quran_id FROM murid WHERE murid_id = ? LIMIT 1)`;
          params = [muridId];
        } else if (actualType === 'kamar') {
          whereClause = `WHERE k.kamar_id = (SELECT kamar_id FROM murid WHERE murid_id = ? LIMIT 1)`;
          params = [muridId];
        }
      } else {
        whereClause = `WHERE 0=1`;
      }
    }

    let query = '';
    if (actualType === 'madin') {
      query = `
        SELECT k.kelas_id as id, k.nama_kelas as nama, g.nama as pembina,
               (SELECT COUNT(*) FROM murid m WHERE m.kelas_madin_id = k.kelas_id) as jumlah_murid
        FROM kelas_madin k
        LEFT JOIN guru g ON k.guru_id = g.guru_id
        ${whereClause}
        ORDER BY k.nama_kelas ASC
      `;
    } else if (actualType === 'quran') {
      query = `
        SELECT k.id as id, k.nama_kelas as nama, g.nama as pembina,
               (SELECT COUNT(*) FROM murid m WHERE m.kelas_quran_id = k.id) as jumlah_murid
        FROM kelas_quran k
        LEFT JOIN guru g ON k.guru_id = g.guru_id
        ${whereClause}
        ORDER BY k.nama_kelas ASC
      `;
    } else if (actualType === 'kamar') {
      query = `
        SELECT k.kamar_id as id, k.nama_kamar as nama, g.nama as pembina,
               (SELECT COUNT(*) FROM murid m WHERE m.kamar_id = k.kamar_id) as jumlah_murid
        FROM kamar k
        LEFT JOIN guru g ON k.guru_id = g.guru_id
        ${whereClause}
        ORDER BY k.nama_kamar ASC
      `;
    } else if (actualType === 'guru') {
      query = `SELECT guru_id as id, nama FROM guru ORDER BY nama ASC`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    if (!payload || ((payload as any).role !== 'admin' && (payload as any).role !== 'staff')) {
      return NextResponse.json({ error: 'Hanya admin/staff yang dapat mengedit' }, { status: 403 });
    }

    const data = await request.json();
    const { id, nama, type } = data; // type: madin, quran, kamar
    if (!id || !nama || !type) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

    if (type === 'madin') {
      await pool.execute('UPDATE kelas_madin SET nama_kelas = ? WHERE kelas_id = ?', [nama, id]);
    } else if (type === 'quran') {
      await pool.execute('UPDATE kelas_quran SET nama_kelas = ? WHERE id = ?', [nama, id]);
    } else if (type === 'kamar') {
      await pool.execute('UPDATE kamar SET nama_kamar = ? WHERE kamar_id = ?', [nama, id]);
    }

    return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
