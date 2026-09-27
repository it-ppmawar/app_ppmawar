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

    // 2. Ambil daftar mata pelajaran dari jadwal_madin berdasarkan kelas yang dipilih
    //    (tersinkronisasi dengan data real absensi — sama seperti halaman rekapitulasi)
    let kurikulumList: any[] = [];
    try {
      let query = `SELECT DISTINCT mata_pelajaran as mata_pelajaran
                   FROM jadwal_madin
                   WHERE mata_pelajaran IS NOT NULL AND mata_pelajaran != ''`;
      const params: any[] = [];
      if (kelasId) {
        query += ` AND kelas_madin_id = ?`;
        params.push(kelasId);
      }
      query += ` ORDER BY mata_pelajaran ASC`;
      const [rows] = await pool.execute<RowDataPacket[]>(query, params);
      kurikulumList = rows.map((r: any, i: number) => ({
        id: i + 1,
        mata_pelajaran: r.mata_pelajaran,
        kitab: '',
      }));
    } catch (err) {
      console.warn('Error fetching mapel from jadwal_madin:', err);
    }

    // Fallback jika jadwal_madin kosong
    if (kurikulumList.length === 0) {
      kurikulumList = [
        { id: 1, mata_pelajaran: 'Fiqih', kitab: 'Safinatun Najah' },
        { id: 2, mata_pelajaran: 'Nahwu', kitab: 'Al-Jurumiyah' },
        { id: 3, mata_pelajaran: 'Shorof', kitab: 'Al-Amtsilah At-Tashrifiyyah' },
        { id: 4, mata_pelajaran: 'Tauhid', kitab: 'Aqidatul Awam' },
        { id: 5, mata_pelajaran: 'Akhlaq', kitab: 'Taisirul Kholaq' },
        { id: 6, mata_pelajaran: 'Hadits', kitab: "Al-Arba'in An-Nawawiyyah" },
        { id: 7, mata_pelajaran: 'Tajwid', kitab: 'Hidayatush Shibyan' },
        { id: 8, mata_pelajaran: "Al-Qur'an & Tahfidz", kitab: "Juz 'Amma & Al-Qur'an" },
      ];
    }

    let muridWithScores: any[] = [];

    if (kelasId) {
      try {
        // 3. Ambil daftar murid beserta info kamar/asrama/alamat
        const [muridRows] = await pool.execute<RowDataPacket[]>(
          `SELECT m.murid_id, m.nama, m.nis, m.jenis_kelamin,
                  COALESCE(m.alamat, '') as alamat,
                  COALESCE(k.nama_kamar, '') as nama_kamar,
                  COALESCE(k.nama_asrama, '') as nama_asrama
           FROM murid m
           LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
           WHERE (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?)
           ORDER BY m.nama ASC`,
          [kelasId, kelasId]
        );

        // 4. Ambil rekap kehadiran dari tabel absensi
        //    Jika mapel dipilih: filter kehadiran berdasarkan jadwal mapel tersebut
        //    Jika belum dipilih: ambil semua kehadiran di kelas ini
        const attendanceMap: Record<number, { persen: number; hadir: number; total: number }> = {};
        if (muridRows.length > 0) {
          try {
            const muridIds = muridRows.map(m => m.murid_id);
            const placeholders = muridIds.map(() => '?').join(',');

            let attQuery: string;
            let attParams: any[];

            if (mapelName) {
              // Kehadiran khusus mapel yang dipilih (JOIN jadwal_madin)
              attQuery = `SELECT a.murid_id,
                            SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir_count,
                            COUNT(*) as total_sesi
                          FROM absensi a
                          JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
                          WHERE a.murid_id IN (${placeholders})
                            AND jm.mata_pelajaran = ?
                          GROUP BY a.murid_id`;
              attParams = [...muridIds, mapelName];
            } else {
              // Semua kehadiran di kelas ini
              attQuery = `SELECT murid_id,
                            SUM(CASE WHEN LOWER(status) = 'hadir' THEN 1 ELSE 0 END) as hadir_count,
                            COUNT(*) as total_sesi
                          FROM absensi
                          WHERE murid_id IN (${placeholders})
                          GROUP BY murid_id`;
              attParams = muridIds;
            }

            const [attRows] = await pool.execute<RowDataPacket[]>(attQuery, attParams);
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

        // 5. Ambil nilai yang sudah tersimpan jika mapel dipilih
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
            alamat: m.alamat || '',
            nama_kamar: m.nama_kamar || '',
            nama_asrama: m.nama_asrama || '',
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
