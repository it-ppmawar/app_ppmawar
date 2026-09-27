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

    // 1. Ambil daftar kelas madin yang tersedia (kolom aman: kelas_id, nama_kelas)
    let kelasList: any[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT kelas_id, nama_kelas FROM kelas_madin ORDER BY nama_kelas ASC'
      );
      kelasList = rows.map(k => {
        const match = (k.nama_kelas || '').match(/\d+/);
        return {
          kelas_id: k.kelas_id,
          nama_kelas: k.nama_kelas,
          tingkat: match ? match[0] : '1',
        };
      });
    } catch (err) {
      console.warn('Error fetching kelas_madin:', err);
    }

    // 2. Ambil daftar mata pelajaran dari kurikulum_madin (dengan fallback standar Madin)
    let kurikulumList: any[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, tingkat, mata_pelajaran, kitab FROM kurikulum_madin ORDER BY tingkat ASC, mata_pelajaran ASC'
      );
      kurikulumList = rows;
    } catch (err) {
      console.warn('Error fetching kurikulum_madin:', err);
    }

    // Jika kurikulum di DB masih kosong, sediakan standar mata pelajaran & kitab pesantren
    if (kurikulumList.length === 0) {
      kurikulumList = [
        { id: 1, tingkat: '1', mata_pelajaran: 'Fiqih', kitab: 'Safinatun Najah' },
        { id: 2, tingkat: '1', mata_pelajaran: 'Nahwu', kitab: 'Al-Jurumiyah' },
        { id: 3, tingkat: '1', mata_pelajaran: 'Shorof', kitab: 'Al-Amtsilah At-Tashrifiyyah' },
        { id: 4, tingkat: '1', mata_pelajaran: 'Tauhid', kitab: 'Aqidatul Awam' },
        { id: 5, tingkat: '1', mata_pelajaran: 'Akhlaq', kitab: 'Taisirul Kholaq' },
        { id: 6, tingkat: '1', mata_pelajaran: 'Hadits', kitab: "Al-Arba'in An-Nawawiyyah" },
        { id: 7, tingkat: '1', mata_pelajaran: 'Tarikh Islam', kitab: 'Khulashoh Nurul Yaqin' },
        { id: 8, tingkat: '1', mata_pelajaran: 'Tajwid', kitab: 'Hidayatush Shibyan' },
        { id: 9, tingkat: '1', mata_pelajaran: "Al-Qur'an & Tahfidz", kitab: "Juz 'Amma & Al-Qur'an" },
        { id: 10, tingkat: '2', mata_pelajaran: 'Fiqih', kitab: 'Fathul Qorib' },
        { id: 11, tingkat: '2', mata_pelajaran: 'Nahwu', kitab: "Nadhom Al-'Imrithi" },
        { id: 12, tingkat: '2', mata_pelajaran: 'Tauhid', kitab: 'Tijan Ad-Darori' },
        { id: 13, tingkat: '2', mata_pelajaran: 'Akhlaq', kitab: "Ta'limul Muta'allim" },
      ];
    }

    let muridWithScores: any[] = [];

    if (kelasId) {
      try {
        // 3. Ambil daftar murid di kelas tersebut (tanpa kolom status yang tidak ada)
        const [muridRows] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nama, nis, jenis_kelamin
           FROM murid
           WHERE (kelas_madin_id = ? OR kelas_madin_2_id = ?)
           ORDER BY nama ASC`,
          [kelasId, kelasId]
        );

        // 4. Ambil rekap kehadiran dari tabel absensi untuk seluruh santri di kelas ini
        const attendanceMap: Record<number, { persen: number; hadir: number; total: number }> = {};
        if (muridRows.length > 0) {
          try {
            const muridIds = muridRows.map(m => m.murid_id);
            const placeholders = muridIds.map(() => '?').join(',');
            const [attRows] = await pool.execute<RowDataPacket[]>(
              `SELECT 
                murid_id,
                SUM(CASE WHEN LOWER(status) = 'hadir' THEN 1 ELSE 0 END) as hadir_count,
                COUNT(*) as total_sesi
               FROM absensi
               WHERE murid_id IN (${placeholders})
               GROUP BY murid_id`,
              muridIds
            );
            attRows.forEach((r: any) => {
              const hadir = Number(r.hadir_count || 0);
              const total = Number(r.total_sesi || 0);
              const persen = total > 0 ? Math.round((hadir / total) * 100) : 100;
              attendanceMap[r.murid_id] = { persen, hadir, total };
            });
          } catch (attErr) {
            console.warn('Error fetching attendance for penilaian:', attErr);
          }
        }

        // 5. Jika ada mata pelajaran yang dipilih, ambil nilai yang sudah ada
        let existingScoresMap: Record<number, any> = {};
        if (mapelName) {
          try {
            const [scoreRows] = await pool.execute<RowDataPacket[]>(
              `SELECT murid_id, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan
               FROM nilai_santri
               WHERE kelas_madin_id = ? AND mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ?`,
              [kelasId, mapelName, semester, tahunAjaran]
            );
            scoreRows.forEach((r: any) => {
              existingScoresMap[r.murid_id] = r;
            });
          } catch (scoreErr) {
            console.warn('Error fetching existing scores:', scoreErr);
          }
        }

        muridWithScores = muridRows.map(m => {
          const score = existingScoresMap[m.murid_id] || {};
          const att = attendanceMap[m.murid_id] || { persen: 100, hadir: 0, total: 0 };
          return {
            murid_id: m.murid_id,
            nama: m.nama,
            nis: m.nis,
            jenis_kelamin: m.jenis_kelamin,
            kehadiran_persen: att.total > 0 ? att.persen : 100,
            kehadiran_total: att.total,
            kehadiran_hadir: att.hadir,
            nilai_harian: score.nilai_harian !== undefined && score.nilai_harian !== null ? Number(score.nilai_harian) : '',
            nilai_uts: score.nilai_uts !== undefined && score.nilai_uts !== null ? Number(score.nilai_uts) : '',
            nilai_uas: score.nilai_uas !== undefined && score.nilai_uas !== null ? Number(score.nilai_uas) : '',
            nilai_akhir: score.nilai_akhir !== undefined && score.nilai_akhir !== null ? Number(score.nilai_akhir) : '',
            predikat: score.predikat || '',
            catatan: score.catatan || '',
          };
        });
      } catch (mErr) {
        console.error('Error fetching murid for kelas:', mErr);
      }
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
