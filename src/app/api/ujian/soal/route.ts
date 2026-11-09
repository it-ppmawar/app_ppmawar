import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ujianId = searchParams.get('ujian_id');

    if (!ujianId) return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });

    const isGuruOrAdmin = ['admin', 'staff', 'guru'].includes(payload.role);

    let query = '';
    if (isGuruOrAdmin) {
      // Tampilkan dengan kunci jawaban untuk pengajar / admin
      query = 'SELECT * FROM ujian_soal WHERE ujian_id = ? ORDER BY nomor_urut ASC, id ASC';
    } else {
      // Untuk santri: sembunyikan kunci_jawaban & pembahasan
      query = `SELECT id, ujian_id, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, bobot_nilai 
               FROM ujian_soal 
               WHERE ujian_id = ? 
               ORDER BY nomor_urut ASC, id ASC`;
    }

    const [rows] = await pool.execute<RowDataPacket[]>(query, [ujianId]);

    return NextResponse.json({ success: true, soal: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff', 'guru'].includes(payload.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    // Dukungan Batch Insert (array of soal)
    if (Array.isArray(body.soal_list) && body.ujian_id) {
      const ujianId = Number(body.ujian_id);
      let count = 0;
      for (const s of body.soal_list) {
        if (!s.pertanyaan || !s.opsi_a || !s.opsi_b) continue;
        await pool.execute(
          `INSERT INTO ujian_soal 
            (ujian_id, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci_jawaban, bobot_nilai, pembahasan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ujianId,
            s.nomor_urut || (count + 1),
            s.pertanyaan.trim(),
            s.gambar || null,
            s.opsi_a.trim(),
            s.opsi_b.trim(),
            s.opsi_c ? s.opsi_c.trim() : '',
            s.opsi_d ? s.opsi_d.trim() : null,
            s.opsi_e ? s.opsi_e.trim() : null,
            (s.kunci_jawaban || 'A').toUpperCase().trim(),
            Number(s.bobot_nilai) || 10,
            s.pembahasan || null,
          ]
        );
        count++;
      }
      return NextResponse.json({ success: true, message: `Berhasil menambahkan ${count} butir soal.` });
    }

    // Single Insert
    const {
      ujian_id,
      nomor_urut = 1,
      pertanyaan,
      gambar = null,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d = null,
      opsi_e = null,
      kunci_jawaban = 'A',
      bobot_nilai = 10,
      pembahasan = null,
    } = body;

    if (!ujian_id || !pertanyaan || !opsi_a || !opsi_b) {
      return NextResponse.json({ error: 'ujian_id, pertanyaan, opsi A, dan opsi B wajib diisi.' }, { status: 400 });
    }

    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ujian_soal 
        (ujian_id, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci_jawaban, bobot_nilai, pembahasan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(ujian_id),
        Number(nomor_urut) || 1,
        pertanyaan.trim(),
        gambar,
        opsi_a.trim(),
        opsi_b.trim(),
        opsi_c ? opsi_c.trim() : '',
        opsi_d ? opsi_d.trim() : null,
        opsi_e ? opsi_e.trim() : null,
        (kunci_jawaban || 'A').toUpperCase().trim(),
        Number(bobot_nilai) || 10,
        pembahasan ? pembahasan.trim() : null,
      ]
    );

    return NextResponse.json({ success: true, message: 'Soal berhasil disimpan.', id: res.insertId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff', 'guru'].includes(payload.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci_jawaban, bobot_nilai, pembahasan } = body;

    if (!id) return NextResponse.json({ error: 'ID Soal diperlukan.' }, { status: 400 });

    await pool.execute(
      `UPDATE ujian_soal SET
        nomor_urut = COALESCE(?, nomor_urut),
        pertanyaan = COALESCE(?, pertanyaan),
        gambar = ?,
        opsi_a = COALESCE(?, opsi_a),
        opsi_b = COALESCE(?, opsi_b),
        opsi_c = COALESCE(?, opsi_c),
        opsi_d = ?,
        opsi_e = ?,
        kunci_jawaban = COALESCE(?, kunci_jawaban),
        bobot_nilai = COALESCE(?, bobot_nilai),
        pembahasan = ?
       WHERE id = ?`,
      [
        nomor_urut || null,
        pertanyaan || null,
        gambar || null,
        opsi_a || null,
        opsi_b || null,
        opsi_c || null,
        opsi_d || null,
        opsi_e || null,
        kunci_jawaban ? kunci_jawaban.toUpperCase() : null,
        bobot_nilai || null,
        pembahasan || null,
        id,
      ]
    );

    return NextResponse.json({ success: true, message: 'Soal berhasil diperbarui.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff', 'guru'].includes(payload.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID Soal diperlukan.' }, { status: 400 });

    await pool.execute('DELETE FROM ujian_soal WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Soal berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
