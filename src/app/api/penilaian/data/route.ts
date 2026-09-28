import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
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

export async function GET(request: Request) {
  try {
    await ensurePenilaianDB();

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
    const kelasId = searchParams.get('kelas_id') || 'SEMUA';
    const mapelName = searchParams.get('mapel');
    const semester = searchParams.get('semester') || '1';
    const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';

    const isSemuaKelas = !kelasId || kelasId === 'SEMUA' || kelasId === 'all';
    const isSemuaMapel = !mapelName || mapelName === 'SEMUA' || mapelName === 'Semua Mapel';

    // Mode Tamu: return struktur kosong yang valid (tidak ada data ditampilkan)
    if (role === 'tamu') {
      return NextResponse.json({ success: true, kelas: [], kurikulum: [], murid: [], muridList: [] });
    }

    // 1. RBAC: Filter daftar kelas madin sesuai wewenang pengguna (seperti halaman rekapitulasi)
    let whereKelas = '';
    let paramsKelas: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        whereKelas = `WHERE k.guru_id = ? OR k.kelas_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)`;
        paramsKelas = [guruId, guruId];
      } else {
        whereKelas = `WHERE 0=1`;
      }
    } else if (role === 'staff') {
      const asr = (namaAsrama || payload.asrama || '').toLowerCase();
      const isPutra = asr === 'putra' || asr.includes('putra') || asr.includes('asrama a') || asr === 'a';
      const isPutri = asr === 'putri' || asr.includes('putri') || asr.includes('asrama b') || asr.includes('asrama c') || asr.includes('asrama d') || asr.includes('asrama e') || asr.includes('asrama f') || ['b', 'c', 'd', 'e', 'f'].includes(asr.trim());

      if (isPutra) {
        whereKelas = "WHERE LOWER(k.nama_kelas) LIKE '%putra%'";
      } else if (isPutri) {
        whereKelas = "WHERE LOWER(k.nama_kelas) LIKE '%putri%'";
      }
    } else if (role === 'wali_murid' || role === 'santri') {
      if (muridId) {
        whereKelas = `WHERE k.kelas_id = (SELECT kelas_madin_id FROM murid WHERE murid_id = ? LIMIT 1)`;
        paramsKelas = [muridId];
      } else {
        whereKelas = `WHERE 0=1`;
      }
    }

    let kelasList: any[] = [];
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT k.kelas_id, k.nama_kelas 
         FROM kelas_madin k 
         ${whereKelas} 
         ORDER BY k.nama_kelas ASC`,
        paramsKelas
      );
      const individualClasses = rows.map(k => {
        const match = (k.nama_kelas || '').match(/\d+/);
        return {
          kelas_id: String(k.kelas_id),
          nama_kelas: k.nama_kelas,
          tingkat: match ? match[0] : '1',
        };
      });

      // Tambahkan opsi "Semua Kelas" di posisi teratas
      if (individualClasses.length > 0) {
        kelasList = [
          {
            kelas_id: 'SEMUA',
            nama_kelas: '✨ Semua Kelas' + (role === 'guru' ? ' (Kelas Ajar Saya)' : ''),
            tingkat: 'All',
          },
          ...individualClasses,
        ];
      } else {
        kelasList = [];
      }
    } catch (err) {
      console.warn('Error fetching kelas_madin with RBAC:', err);
    }

    // 2. Ambil daftar mata pelajaran dari jadwal_madin
    //    RBAC: Jika guru, hanya tampilkan mapel yang diajarkan guru tersebut
    let kurikulumList: any[] = [];
    try {
      let query = `SELECT DISTINCT mata_pelajaran as mata_pelajaran
                   FROM jadwal_madin
                   WHERE mata_pelajaran IS NOT NULL AND mata_pelajaran != ''`;
      const params: any[] = [];

      if (!isSemuaKelas) {
        query += ` AND kelas_madin_id = ?`;
        params.push(kelasId);
      } else if (role === 'guru' && guruId) {
        // Jika Semua Kelas dan user adalah Guru: ambil mapel dari seluruh kelas ajar guru ini
        query += ` AND kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)`;
        params.push(guruId);
      }

      if (role === 'guru' && guruId) {
        query += ` AND guru_id = ?`;
        params.push(guruId);
      }

      query += ` ORDER BY mata_pelajaran ASC`;
      const [rows] = await pool.execute<RowDataPacket[]>(query, params);
      
      const distinctMapels = rows.map((r: any, i: number) => ({
        id: i + 1,
        mata_pelajaran: r.mata_pelajaran,
        kitab: '',
      }));

      // Tambahkan opsi "Semua Mapel" di posisi pertama
      kurikulumList = [
        { id: 'SEMUA', mata_pelajaran: 'Semua Mapel', kitab: '' },
        ...distinctMapels,
      ];
    } catch (err) {
      console.warn('Error fetching mapel from jadwal_madin:', err);
      kurikulumList = [{ id: 'SEMUA', mata_pelajaran: 'Semua Mapel', kitab: '' }];
    }

    let muridWithScores: any[] = [];

    try {
      // 3. Ambil daftar murid beserta info kamar/asrama/alamat/nama_kelas
      let whereMurid = '';
      let paramsMurid: any[] = [];

      if (!isSemuaKelas) {
        whereMurid = `WHERE (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?)`;
        paramsMurid = [kelasId, kelasId];
      } else {
        // Semua Kelas: batasi sesuai RBAC role pengguna
        if (role === 'guru' && guruId) {
          whereMurid = `WHERE (m.kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?) 
                         OR m.kelas_madin_2_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
                         OR km.guru_id = ?)`;
          paramsMurid = [guruId, guruId, guruId];
        } else if (role === 'staff') {
          const asr = (namaAsrama || payload.asrama || '').toLowerCase();
          const isPutra = asr === 'putra' || asr.includes('putra') || asr.includes('asrama a') || asr === 'a';
          const isPutri = asr === 'putri' || asr.includes('putri') || asr.includes('asrama b') || asr.includes('asrama c') || asr.includes('asrama d') || asr.includes('asrama e') || asr.includes('asrama f') || ['b', 'c', 'd', 'e', 'f'].includes(asr.trim());
          if (isPutra) {
            whereMurid = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL) AND LOWER(km.nama_kelas) LIKE '%putra%'`;
          } else if (isPutri) {
            whereMurid = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL) AND LOWER(km.nama_kelas) LIKE '%putri%'`;
          } else {
            whereMurid = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL)`;
          }
        } else if (role === 'wali_murid' || role === 'santri') {
          if (muridId) {
            whereMurid = `WHERE m.murid_id = ?`;
            paramsMurid = [muridId];
          } else {
            whereMurid = `WHERE 0=1`;
          }
        } else {
          // Admin: semua kelas
          whereMurid = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL)`;
        }
      }

      const [muridRows] = await pool.execute<RowDataPacket[]>(
        `SELECT m.murid_id, m.nama, m.nis, m.jenis_kelamin,
                COALESCE(m.alamat, '') as alamat,
                COALESCE(k.nama_kamar, '') as nama_kamar,
                COALESCE(k.nama_asrama, '') as nama_asrama,
                COALESCE(km.nama_kelas, '') as nama_kelas,
                COALESCE(m.kelas_madin_id, 0) as kelas_madin_id
         FROM murid m
         LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
         LEFT JOIN kelas_madin km ON (m.kelas_madin_id = km.kelas_id OR m.kelas_madin_2_id = km.kelas_id)
         ${whereMurid}
         ORDER BY km.nama_kelas ASC, m.nama ASC`,
        paramsMurid
      );

      if (muridRows.length > 0) {
        const muridIds = muridRows.map(m => m.murid_id);
        const placeholders = muridIds.map(() => '?').join(',');

        // 4. Ambil rekap kehadiran dari tabel absensi
        const attendanceMap: Record<number, { persen: number; hadir: number; total: number }> = {};
        try {
          let attQuery: string;
          let attParams: any[];

          if (!isSemuaMapel) {
            // Kehadiran khusus mapel tertentu
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
            // Kehadiran seluruh sesi
            attQuery = `SELECT a.murid_id,
                          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir_count,
                          COUNT(*) as total_sesi
                        FROM absensi a
                        WHERE a.murid_id IN (${placeholders})
                        GROUP BY a.murid_id`;
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
          console.warn('Error fetching attendance:', attErr);
        }

        // 5. Ambil data nilai
        if (isSemuaMapel) {
          // MODE LEGER KOLEKTIF: Ambil rata-rata nilai dari seluruh mata pelajaran yang sudah dinilai
          let avgQuery = `SELECT 
              murid_id,
              AVG(CASE WHEN nilai_harian IS NOT NULL AND nilai_harian != '' THEN CAST(nilai_harian AS DECIMAL(5,2)) END) as avg_harian,
              AVG(CASE WHEN nilai_uts IS NOT NULL AND nilai_uts != '' THEN CAST(nilai_uts AS DECIMAL(5,2)) END) as avg_uts,
              AVG(CASE WHEN nilai_uas IS NOT NULL AND nilai_uas != '' THEN CAST(nilai_uas AS DECIMAL(5,2)) END) as avg_uas,
              AVG(CASE WHEN nilai_akhir IS NOT NULL AND nilai_akhir != '' THEN CAST(nilai_akhir AS DECIMAL(5,2)) END) as avg_akhir,
              COUNT(DISTINCT mata_pelajaran) as total_mapel_dinilai
             FROM nilai_santri
             WHERE semester = ? AND tahun_ajaran = ? AND murid_id IN (${placeholders})`;
          let avgParams = [semester, tahunAjaran, ...muridIds];

          if (!isSemuaKelas) {
            avgQuery += ` AND kelas_madin_id = ?`;
            avgParams.push(kelasId);
          }
          avgQuery += ` GROUP BY murid_id`;

          const [avgRows] = await pool.execute<RowDataPacket[]>(avgQuery, avgParams);

          const avgMap: Record<number, any> = {};
          avgRows.forEach((r: any) => {
            avgMap[r.murid_id] = r;
          });

          muridWithScores = muridRows.map(m => {
            const r = avgMap[m.murid_id];
            const att = attendanceMap[m.murid_id] || { persen: 100, hadir: 0, total: 0 };
            const totalMapel = r ? Number(r.total_mapel_dinilai || 0) : 0;
            const harian = r && r.avg_harian !== null ? Number(r.avg_harian).toFixed(1) : '';
            const uts = r && r.avg_uts !== null ? Number(r.avg_uts).toFixed(1) : '';
            const uas = r && r.avg_uas !== null ? Number(r.avg_uas).toFixed(1) : '';
            const akhir = r && r.avg_akhir !== null ? Number(r.avg_akhir).toFixed(1) : '';
            const predikat = akhir !== '' ? calcPredikat(parseFloat(akhir)) : '-';

            return {
              murid_id: m.murid_id,
              nama: m.nama,
              nis: m.nis,
              jenis_kelamin: m.jenis_kelamin,
              alamat: m.alamat || '',
              nama_kamar: m.nama_kamar || '',
              nama_asrama: m.nama_asrama || '',
              nama_kelas: m.nama_kelas || '',
              kelas_madin_id: m.kelas_madin_id,
              kehadiran_persen: att.total > 0 ? att.persen : 100,
              kehadiran_total: att.total,
              kehadiran_hadir: att.hadir,
              nilai_harian: harian,
              nilai_uts: uts,
              nilai_uas: uas,
              nilai_akhir: akhir,
              predikat: predikat,
              catatan: totalMapel > 0 ? `${totalMapel} Mapel Dinilai` : 'Belum Ada Nilai',
              total_mapel_dinilai: totalMapel,
              is_leger: true,
            };
          });
        } else {
          // MODE INPUT MAPEL SPESIFIK: Ambil nilai spesifik mapel tersebut
          let existingScoresMap: Record<number, any> = {};
          try {
            let scoreQuery = `SELECT murid_id, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan
               FROM nilai_santri
               WHERE mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ? AND murid_id IN (${placeholders})`;
            let scoreParams = [mapelName, semester, tahunAjaran, ...muridIds];

            if (!isSemuaKelas) {
              scoreQuery += ` AND kelas_madin_id = ?`;
              scoreParams.push(kelasId);
            }

            const [scoreRows] = await pool.execute<RowDataPacket[]>(scoreQuery, scoreParams);
            scoreRows.forEach((r: any) => {
              existingScoresMap[r.murid_id] = r;
            });
          } catch (scoreErr) {
            console.warn('Error fetching existing scores:', scoreErr);
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
              nama_kelas: m.nama_kelas || '',
              kelas_madin_id: m.kelas_madin_id,
              kehadiran_persen: att.total > 0 ? att.persen : 100,
              kehadiran_total: att.total,
              kehadiran_hadir: att.hadir,
              nilai_harian: score.nilai_harian !== undefined && score.nilai_harian !== null ? Number(score.nilai_harian) : '',
              nilai_uts: score.nilai_uts !== undefined && score.nilai_uts !== null ? Number(score.nilai_uts) : '',
              nilai_uas: score.nilai_uas !== undefined && score.nilai_uas !== null ? Number(score.nilai_uas) : '',
              nilai_akhir: score.nilai_akhir !== undefined && score.nilai_akhir !== null ? Number(score.nilai_akhir) : '',
              predikat: score.predikat || '',
              catatan: score.catatan || '',
              total_mapel_dinilai: 1,
              is_leger: false,
            };
          });
        }
      }
    } catch (mErr) {
      console.error('Error fetching murid for kelas:', mErr);
    }

    return NextResponse.json({
      success: true,
      kelas: kelasList,
      kurikulum: kurikulumList,
      muridList: muridWithScores,
      is_semua_kelas: isSemuaKelas,
      is_semua_mapel: isSemuaMapel,
    });
  } catch (error: any) {
    console.error('Error in /api/penilaian/data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
