import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload) return null;
  return payload;
}

// GET: Ambil data jurnal berdasarkan role
export async function GET(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, guruId, userId, username, muridId } = auth;
    const tokenAsrama = auth.namaAsrama || null;

    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

    const { searchParams } = new URL(request.url);
    const tipe = searchParams.get('tipe') || 'all';

    // Build where clause berdasarkan role (mirip jadwal)
    let whereGuruMadin = '1=1';
    let whereGuruQuran = '1=1';
    let wherePembinaKamar = '1=1';
    let paramsMadin: any[] = [];
    let paramsQuran: any[] = [];
    let paramsKamar: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        // Guru: ambil user_id dari tabel guru
        const [guruRows] = await pool.execute<RowDataPacket[]>(
          'SELECT user_id FROM guru WHERE guru_id = ? LIMIT 1', [guruId]
        );
        const guruUserId = guruRows.length > 0 ? guruRows[0].user_id : null;
        if (guruUserId) {
          whereGuruMadin = 'jm.guru_id = ?';
          whereGuruQuran = 'jq.guru_id = ?';
          wherePembinaKamar = 'jk.pembina_id = ?';
          paramsMadin = [guruUserId];
          paramsQuran = [guruUserId];
          paramsKamar = [guruUserId];
        } else {
          // Fallback: coba gunakan userId dari token
          whereGuruMadin = 'jm.guru_id = ?';
          whereGuruQuran = 'jq.guru_id = ?';
          wherePembinaKamar = 'jk.pembina_id = ?';
          paramsMadin = [userId];
          paramsQuran = [userId];
          paramsKamar = [userId];
        }
      } else {
        whereGuruMadin = '0=1';
        whereGuruQuran = '0=1';
        wherePembinaKamar = '0=1';
      }
    } else if (role === 'pengurus_asrama' || role === 'pengasuh') {
      if (namaAsrama) {
        if (role === 'pengasuh') {
          // Pengasuh hanya untuk asrama/kegiatan pesantren, bukan madrasah (madin/quran)
          whereGuruMadin = '0=1';
          whereGuruQuran = '0=1';
        } else {
          whereGuruMadin = `jm.kelas_id IN (
            SELECT DISTINCT m.kelas_madin_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_madin_id IS NOT NULL
          )`;
          whereGuruQuran = `jq.kelas_quran_id IN (
            SELECT DISTINCT m.kelas_quran_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
          )`;
        }
        wherePembinaKamar = `jk.kamar_id IN (
          SELECT kamar_id FROM kamar WHERE nama_asrama = ?
        )`;
        paramsMadin = [namaAsrama];
        paramsQuran = [namaAsrama];
        paramsKamar = [namaAsrama];
      } else {
        whereGuruMadin = '0=1';
        whereGuruQuran = '0=1';
        wherePembinaKamar = '0=1';
      }
    } else if (role !== 'admin' && role !== 'staff') {
      // Wali murid / alumni / tamu -> read limited
      if (muridId) {
        whereGuruMadin = 'jm.kelas_id = (SELECT kelas_madin_id FROM murid WHERE murid_id = ? LIMIT 1)';
        whereGuruQuran = 'jq.kelas_quran_id = (SELECT kelas_quran_id FROM murid WHERE murid_id = ? LIMIT 1)';
        wherePembinaKamar = 'jk.kamar_id = (SELECT kamar_id FROM murid WHERE murid_id = ? LIMIT 1)';
        paramsMadin = [muridId];
        paramsQuran = [muridId];
        paramsKamar = [muridId];
      } else {
        whereGuruMadin = '0=1';
        whereGuruQuran = '0=1';
        wherePembinaKamar = '0=1';
      }
    }

    const result: any = {};

    // Jurnal Madin
    if (tipe === 'all' || tipe === 'madin') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT jm.id, jm.tanggal, jm.guru_id, jm.kelas_id, jm.materi, jm.catatan, jm.kendala, jm.created_at,
                g.nama as guru_nama, k.nama_kelas as kelas_nama, 'madin' as tipe
         FROM jurnal_madin jm
         LEFT JOIN guru g ON jm.guru_id = g.guru_id OR jm.guru_id = g.user_id
         LEFT JOIN kelas_madin k ON jm.kelas_id = k.kelas_id
         WHERE ${whereGuruMadin}
         ORDER BY jm.tanggal DESC, jm.created_at DESC`,
        paramsMadin
      );
      result.madin = rows;
    }

    // Jurnal Quran
    if (tipe === 'all' || tipe === 'quran') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT jq.id, jq.tanggal, jq.guru_id, jq.kelas_quran_id, jq.materi, jq.catatan, jq.kendala, jq.created_at,
                g.nama as guru_nama, k.nama_kelas as kelas_nama, 'quran' as tipe
         FROM jurnal_quran jq
         LEFT JOIN guru g ON jq.guru_id = g.guru_id OR jq.guru_id = g.user_id
         LEFT JOIN kelas_quran k ON jq.kelas_quran_id = k.id
         WHERE ${whereGuruQuran}
         ORDER BY jq.tanggal DESC, jq.created_at DESC`,
        paramsQuran
      );
      result.quran = rows;
    }

    // Jurnal Kamar
    if (tipe === 'all' || tipe === 'kamar') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT jk.id, jk.tanggal, jk.pembina_id, jk.kamar_id, jk.kegiatan, jk.catatan, jk.kendala, jk.created_at,
                g.nama as pembina_nama, k.nama_kamar as kamar_nama, 'kamar' as tipe
         FROM jurnal_kamar jk
         LEFT JOIN guru g ON jk.pembina_id = g.guru_id OR jk.pembina_id = g.user_id
         LEFT JOIN kamar k ON jk.kamar_id = k.kamar_id
         WHERE ${wherePembinaKamar}
         ORDER BY jk.tanggal DESC, jk.created_at DESC`,
        paramsKamar
      );
      result.kamar = rows;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error GET /api/jurnal:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// POST: Tambah jurnal
export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, userId } = auth;
    // Guru bisa tambah jurnal miliknya, admin/staff bisa tambah untuk siapa saja
    if (role !== 'admin' && role !== 'staff' && role !== 'guru' && role !== 'pengurus_asrama' && role !== 'pengasuh') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { tipe, tanggal, kelas_id, materi, catatan, kendala } = body;

    if (!tipe || !tanggal || !kelas_id || !materi) {
      return NextResponse.json({ error: 'Data tidak lengkap (tipe, tanggal, kelas, materi wajib diisi)' }, { status: 400 });
    }

    const guruIdForInsert = body.guru_id || userId;

    if (tipe === 'madin') {
      await pool.execute(
        `INSERT INTO jurnal_madin (tanggal, guru_id, kelas_id, materi, catatan, kendala) VALUES (?, ?, ?, ?, ?, ?)`,
        [tanggal, guruIdForInsert, kelas_id, materi, catatan || '', kendala || null]
      );
    } else if (tipe === 'quran') {
      await pool.execute(
        `INSERT INTO jurnal_quran (tanggal, guru_id, kelas_quran_id, materi, catatan, kendala) VALUES (?, ?, ?, ?, ?, ?)`,
        [tanggal, guruIdForInsert, kelas_id, materi, catatan || '', kendala || null]
      );
    } else if (tipe === 'kamar') {
      await pool.execute(
        `INSERT INTO jurnal_kamar (tanggal, pembina_id, kamar_id, kegiatan, catatan, kendala) VALUES (?, ?, ?, ?, ?, ?)`,
        [tanggal, guruIdForInsert, kelas_id, materi, catatan || '', kendala || null]
      );
    } else {
      return NextResponse.json({ error: 'Tipe jurnal tidak valid' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Jurnal berhasil ditambahkan' });
  } catch (error: any) {
    console.error('Error POST /api/jurnal:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// PUT: Edit jurnal
export async function PUT(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role } = auth;
    if (role !== 'admin' && role !== 'staff' && role !== 'guru' && role !== 'pengurus_asrama' && role !== 'pengasuh') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, tipe, tanggal, kelas_id, materi, catatan, kendala } = body;

    if (!id || !tipe) {
      return NextResponse.json({ error: 'ID dan tipe wajib diisi' }, { status: 400 });
    }

    let query = '';
    let params: any[] = [];

    if (tipe === 'madin') {
      query = `UPDATE jurnal_madin SET tanggal = ?, kelas_id = ?, materi = ?, catatan = ?, kendala = ? WHERE id = ?`;
      params = [tanggal, kelas_id, materi, catatan || '', kendala || null, id];
    } else if (tipe === 'quran') {
      query = `UPDATE jurnal_quran SET tanggal = ?, kelas_quran_id = ?, materi = ?, catatan = ?, kendala = ? WHERE id = ?`;
      params = [tanggal, kelas_id, materi, catatan || '', kendala || null, id];
    } else if (tipe === 'kamar') {
      query = `UPDATE jurnal_kamar SET tanggal = ?, kamar_id = ?, kegiatan = ?, catatan = ?, kendala = ? WHERE id = ?`;
      params = [tanggal, kelas_id, materi, catatan || '', kendala || null, id];
    } else {
      return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(query, params);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Jurnal berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// DELETE: Hapus jurnal
export async function DELETE(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role } = auth;
    if (role !== 'admin' && role !== 'staff' && role !== 'guru' && role !== 'pengurus_asrama' && role !== 'pengasuh') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tipe = searchParams.get('tipe');

    if (!id || !tipe) {
      return NextResponse.json({ error: 'ID dan tipe harus disertakan' }, { status: 400 });
    }

    let query = '';
    if (tipe === 'madin') {
      query = `DELETE FROM jurnal_madin WHERE id = ?`;
    } else if (tipe === 'quran') {
      query = `DELETE FROM jurnal_quran WHERE id = ?`;
    } else if (tipe === 'kamar') {
      query = `DELETE FROM jurnal_kamar WHERE id = ?`;
    } else {
      return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
    }

    const [result] = await pool.execute<ResultSetHeader>(query, [id]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Jurnal berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
