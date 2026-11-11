import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

function calcPredikat(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score > 0) return 'E';
  return '-';
}

// GET: Ambil daftar jawaban essay santri untuk dikoreksi guru
export async function GET(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const userRoleLower = (payload.role || '').toLowerCase();
    const canReview = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!canReview) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ujianId = searchParams.get('ujian_id');
    const muridId = searchParams.get('murid_id');

    if (!ujianId) {
      return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });
    }

    let whereClause = 'ej.ujian_id = ?';
    const params: any[] = [ujianId];

    if (muridId) {
      whereClause += ' AND ej.murid_id = ?';
      params.push(muridId);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         ej.id,
         ej.ujian_id,
         ej.murid_id,
         ej.soal_id,
         ej.jawaban_santri,
         ej.bobot_maksimal,
         ej.skor_final,
         ej.skor_ai,
         ej.feedback_ai,
         ej.kata_kunci_terdeteksi,
         ej.status_koreksi,
         ej.catatan_guru,
         ej.dikoreksi_pada,
         s.nomor_urut,
         s.pertanyaan,
         s.kunci_jawaban AS kunci_ideal,
         s.rubrik_kata_kunci,
         m.nama AS nama_santri,
         m.nis,
         km.nama_kelas
       FROM ujian_essay_jawaban ej
       JOIN ujian_soal s ON ej.soal_id = s.id
       JOIN murid m ON ej.murid_id = m.murid_id
       LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
       WHERE ${whereClause}
       ORDER BY m.nama ASC, s.nomor_urut ASC`,
      params
    );

    return NextResponse.json({ success: true, essay_list: rows });
  } catch (error: any) {
    console.error('Error GET /api/ujian/essay:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Guru menyimpan / menyetujui nilai essay santri dan sinkronkan ke Raport
export async function POST(request: Request) {
  try {
    await ensureUjianDB();
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const userRoleLower = (payload.role || '').toLowerCase();
    const canReview = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!canReview) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const body = await request.json();
    const { ujian_id, murid_id, grades = [] } = body;

    if (!ujian_id || !murid_id) {
      return NextResponse.json({ error: 'ujian_id dan murid_id diperlukan.' }, { status: 400 });
    }

    // Update masing-masing butir jawaban essay
    for (const g of grades) {
      const essayId = g.id;
      const skorFinal = g.skor_final !== undefined && g.skor_final !== null ? Number(g.skor_final) : null;
      const catatanGuru = g.catatan_guru || null;

      if (essayId) {
        await pool.execute(
          `UPDATE ujian_essay_jawaban SET
             skor_final = ?,
             catatan_guru = ?,
             status_koreksi = 'disetujui',
             dikoreksi_oleh = ?,
             dikoreksi_pada = NOW()
           WHERE id = ? AND ujian_id = ? AND murid_id = ?`,
          [skorFinal, catatanGuru, payload.userId || null, essayId, ujian_id, murid_id]
        );
      }
    }

    // Ambil info ujian
    const [ujianRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, judul, mata_pelajaran, semester, tahun_ajaran, jenis_ujian, passing_grade FROM ujian_madin WHERE id = ? LIMIT 1',
      [ujian_id]
    );
    if (ujianRows.length === 0) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }
    const exam = ujianRows[0];

    // Ambil semua soal pada ujian ini untuk menghitung total bobot mungkin
    const [allSoal] = await pool.execute<RowDataPacket[]>(
      'SELECT id, tipe_soal, bobot_nilai FROM ujian_soal WHERE ujian_id = ?',
      [ujian_id]
    );
    let totalPossible = 0;
    for (const s of allSoal) {
      totalPossible += Number(s.bobot_nilai) || 10;
    }

    // Ambil hasil PG murid dari ujian_hasil_santri
    const [hasilSantri] = await pool.execute<RowDataPacket[]>(
      'SELECT id, nilai_pg FROM ujian_hasil_santri WHERE ujian_id = ? AND murid_id = ? LIMIT 1',
      [ujian_id, murid_id]
    );
    const pgPointsEarned = hasilSantri.length > 0 ? Number(hasilSantri[0].nilai_pg) || 0 : 0;

    // Ambil total nilai essay murid yang disetujui
    const [essayScores] = await pool.execute<RowDataPacket[]>(
      'SELECT SUM(COALESCE(skor_final, 0)) AS total_essay, COUNT(*) as total_essay_soal, SUM(CASE WHEN skor_final IS NULL THEN 1 ELSE 0 END) as pending_count FROM ujian_essay_jawaban WHERE ujian_id = ? AND murid_id = ?',
      [ujian_id, murid_id]
    );
    const essayPointsEarned = Number(essayScores[0]?.total_essay) || 0;
    const isAllGraded = Number(essayScores[0]?.pending_count || 0) === 0;

    // Kalkulasi skor akhir skala 0-100
    const totalEarned = pgPointsEarned + essayPointsEarned;
    let finalScore = 0;
    if (totalPossible > 0) {
      finalScore = Math.round((totalEarned / totalPossible) * 100 * 100) / 100;
    }
    const isPassed = finalScore >= Number(exam.passing_grade || 70);

    // Update ujian_hasil_santri
    await pool.execute(
      `UPDATE ujian_hasil_santri SET
         nilai_essay = ?,
         skor_akhir = ?,
         status_lulus = ?,
         status_koreksi = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE ujian_id = ? AND murid_id = ?`,
      [
        essayPointsEarned,
        finalScore,
        isPassed ? 1 : 0,
        isAllGraded ? 'selesai' : 'menunggu_koreksi',
        ujian_id,
        murid_id,
      ]
    );

    // Jika seluruh soal essay sudah dinilai, sinkronkan nilai akhir ke raport (nilai_santri)
    if (isAllGraded) {
      try {
        const [existingNilai] = await pool.execute<RowDataPacket[]>(
          `SELECT id, nilai_harian, nilai_uts, nilai_uas, catatan 
           FROM nilai_santri 
           WHERE murid_id = ? AND mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ? 
           LIMIT 1`,
          [murid_id, exam.mata_pelajaran, exam.semester, exam.tahun_ajaran]
        );

        let harian = 0;
        let uts = 0;
        let uas = 0;
        let catatanBaru = `CBT: ${exam.judul} (${finalScore})`;

        if (existingNilai.length > 0) {
          const ex = existingNilai[0];
          harian = ex.nilai_harian !== null ? Number(ex.nilai_harian) : 0;
          uts = ex.nilai_uts !== null ? Number(ex.nilai_uts) : 0;
          uas = ex.nilai_uas !== null ? Number(ex.nilai_uas) : 0;
          if (ex.catatan) catatanBaru = `${ex.catatan}; ${catatanBaru}`;
        }

        if (exam.jenis_ujian === 'uts') {
          uts = finalScore;
        } else if (exam.jenis_ujian === 'uas') {
          uas = finalScore;
        } else {
          harian = finalScore;
        }

        const nilaiAkhir = Math.round((harian * 0.3 + uts * 0.3 + uas * 0.4) * 100) / 100;
        const predikat = calcPredikat(nilaiAkhir);

        if (existingNilai.length > 0) {
          await pool.execute(
            `UPDATE nilai_santri SET
               nilai_harian = ?,
               nilai_uts = ?,
               nilai_uas = ?,
               nilai_akhir = ?,
               predikat = ?,
               catatan = ?,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [harian, uts, uas, nilaiAkhir, predikat, catatanBaru, existingNilai[0].id]
          );
        } else {
          await pool.execute(
            `INSERT INTO nilai_santri 
               (murid_id, mata_pelajaran, semester, tahun_ajaran, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [murid_id, exam.mata_pelajaran, exam.semester, exam.tahun_ajaran, harian, uts, uas, nilaiAkhir, predikat, catatanBaru]
          );
        }
      } catch (err: any) {
        console.error('Error auto-syncing raport after essay grade:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Nilai essay berhasil disimpan dan diperbarui.',
      final_score: finalScore,
      status_koreksi: isAllGraded ? 'selesai' : 'menunggu_koreksi',
    });
  } catch (error: any) {
    console.error('Error POST /api/ujian/essay:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
