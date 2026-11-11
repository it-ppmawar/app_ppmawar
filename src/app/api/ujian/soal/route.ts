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

    const userRoleLower = (payload.role || '').toLowerCase();
    const isGuruOrAdmin = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);

    let query = '';
    if (isGuruOrAdmin) {
      // Tampilkan dengan kunci jawaban & rubrik untuk pengajar / admin
      query = 'SELECT * FROM ujian_soal WHERE ujian_id = ? ORDER BY nomor_urut ASC, id ASC';
    } else {
      // Untuk santri: sembunyikan kunci_jawaban, pembahasan, & rubrik AI
      query = `SELECT id, ujian_id, tipe_soal, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, bobot_nilai 
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
    const userRoleLower = (payload.role || '').toLowerCase();
    const canManageSoal = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!payload || !canManageSoal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();

    // Dukungan Batch Insert (array of soal)
    if (Array.isArray(body.soal_list) && body.ujian_id) {
      const ujianId = Number(body.ujian_id);
      let count = 0;
      for (const s of body.soal_list) {
        if (!s.pertanyaan) continue;
        const tipe = s.tipe_soal === 'essay' ? 'essay' : 'pilihan_ganda';
        if (tipe === 'pilihan_ganda' && (!s.opsi_a || !s.opsi_b)) continue;

        await pool.execute(
          `INSERT INTO ujian_soal 
            (ujian_id, tipe_soal, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci_jawaban, rubrik_kata_kunci, bobot_nilai, pembahasan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ujianId,
            tipe,
            s.nomor_urut || (count + 1),
            s.pertanyaan.trim(),
            s.gambar || null,
            s.opsi_a ? s.opsi_a.trim() : null,
            s.opsi_b ? s.opsi_b.trim() : null,
            s.opsi_c ? s.opsi_c.trim() : null,
            s.opsi_d ? s.opsi_d.trim() : null,
            s.opsi_e ? s.opsi_e.trim() : null,
            s.kunci_jawaban ? s.kunci_jawaban.trim() : (tipe === 'pilihan_ganda' ? 'A' : null),
            s.rubrik_kata_kunci ? s.rubrik_kata_kunci.trim() : null,
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
      tipe_soal = 'pilihan_ganda',
      nomor_urut = 1,
      pertanyaan,
      gambar = null,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d = null,
      opsi_e = null,
      kunci_jawaban = '',
      rubrik_kata_kunci = null,
      bobot_nilai = 10,
      pembahasan = null,
    } = body;

    const normalizedTipe = tipe_soal === 'essay' ? 'essay' : 'pilihan_ganda';

    if (!ujian_id || !pertanyaan) {
      return NextResponse.json({ error: 'ujian_id dan pertanyaan wajib diisi.' }, { status: 400 });
    }

    if (normalizedTipe === 'pilihan_ganda' && (!opsi_a || !opsi_b)) {
      return NextResponse.json({ error: 'Untuk soal pilihan ganda, Opsi A dan Opsi B wajib diisi.' }, { status: 400 });
    }

    const [res] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ujian_soal 
        (ujian_id, tipe_soal, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci_jawaban, rubrik_kata_kunci, bobot_nilai, pembahasan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(ujian_id),
        normalizedTipe,
        Number(nomor_urut) || 1,
        pertanyaan.trim(),
        gambar,
        opsi_a ? opsi_a.trim() : null,
        opsi_b ? opsi_b.trim() : null,
        opsi_c ? opsi_c.trim() : null,
        opsi_d ? opsi_d.trim() : null,
        opsi_e ? opsi_e.trim() : null,
        kunci_jawaban ? kunci_jawaban.trim() : (normalizedTipe === 'pilihan_ganda' ? 'A' : null),
        rubrik_kata_kunci ? rubrik_kata_kunci.trim() : null,
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
    const userRoleLower = (payload.role || '').toLowerCase();
    const canManageSoal = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!payload || !canManageSoal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      tipe_soal,
      nomor_urut,
      pertanyaan,
      gambar,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d,
      opsi_e,
      kunci_jawaban,
      rubrik_kata_kunci,
      bobot_nilai,
      pembahasan
    } = body;

    if (!id) return NextResponse.json({ error: 'ID Soal diperlukan.' }, { status: 400 });

    await pool.execute(
      `UPDATE ujian_soal SET
        tipe_soal = COALESCE(?, tipe_soal),
        nomor_urut = COALESCE(?, nomor_urut),
        pertanyaan = COALESCE(?, pertanyaan),
        gambar = ?,
        opsi_a = ?,
        opsi_b = ?,
        opsi_c = ?,
        opsi_d = ?,
        opsi_e = ?,
        kunci_jawaban = COALESCE(?, kunci_jawaban),
        rubrik_kata_kunci = ?,
        bobot_nilai = COALESCE(?, bobot_nilai),
        pembahasan = ?
       WHERE id = ?`,
      [
        tipe_soal || null,
        nomor_urut || null,
        pertanyaan || null,
        gambar || null,
        opsi_a !== undefined ? opsi_a : null,
        opsi_b !== undefined ? opsi_b : null,
        opsi_c !== undefined ? opsi_c : null,
        opsi_d !== undefined ? opsi_d : null,
        opsi_e !== undefined ? opsi_e : null,
        kunci_jawaban !== undefined ? kunci_jawaban : null,
        rubrik_kata_kunci !== undefined ? rubrik_kata_kunci : null,
        bobot_nilai || null,
        pembahasan !== undefined ? pembahasan : null,
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
    const userRoleLower = (payload.role || '').toLowerCase();
    const canManageSoal = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!payload || !canManageSoal) {
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
