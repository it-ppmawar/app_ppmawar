import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const kelasId = searchParams.get('kelas_id');
    const mapelName = searchParams.get('mapel');
    const semester = searchParams.get('semester') || '1';
    const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';

    // 1. Ambil daftar kelas madin yang tersedia
    const [kelasList] = await pool.execute<RowDataPacket[]>(
      'SELECT kelas_id, nama_kelas, tingkat FROM kelas_madin ORDER BY nama_kelas ASC'
    );

    // 2. Ambil daftar mata pelajaran dari kurikulum_madin
    const [kurikulumList] = await pool.execute<RowDataPacket[]>(
      'SELECT id, tingkat, mata_pelajaran, kitab FROM kurikulum_madin ORDER BY tingkat ASC, mata_pelajaran ASC'
    );

    let muridWithScores: any[] = [];

    if (kelasId) {
      // 3. Ambil daftar murid di kelas tersebut
      const [muridRows] = await pool.execute<RowDataPacket[]>(
        `SELECT murid_id, nama, nis, jenis_kelamin
         FROM murid
         WHERE kelas_madin_id = ? AND (status IS NULL OR status = 'aktif')
         ORDER BY nama ASC`,
        [kelasId]
      );

      // 4. Jika ada mata pelajaran yang dipilih, ambil nilai yang sudah ada
      let existingScoresMap: Record<number, any> = {};
      if (mapelName) {
        const [scoreRows] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan
           FROM nilai_santri
           WHERE kelas_madin_id = ? AND mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ?`,
          [kelasId, mapelName, semester, tahunAjaran]
        );
        scoreRows.forEach((r: any) => {
          existingScoresMap[r.murid_id] = r;
        });
      }

      muridWithScores = muridRows.map(m => {
        const score = existingScoresMap[m.murid_id] || {};
        return {
          murid_id: m.murid_id,
          nama: m.nama,
          nis: m.nis,
          jenis_kelamin: m.jenis_kelamin,
          nilai_harian: score.nilai_harian !== undefined ? Number(score.nilai_harian) : null,
          nilai_uts: score.nilai_uts !== undefined ? Number(score.nilai_uts) : null,
          nilai_uas: score.nilai_uas !== undefined ? Number(score.nilai_uas) : null,
          nilai_akhir: score.nilai_akhir !== undefined ? Number(score.nilai_akhir) : null,
          predikat: score.predikat || '',
          catatan: score.catatan || '',
        };
      });
    }

    return NextResponse.json({
      success: true,
      kelas: kelasList,
      kurikulum: kurikulumList,
      muridList: muridWithScores,
    });
  } catch (error: any) {
    console.error('Error in /api/penilaian/data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
