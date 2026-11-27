import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { resolvePenilaianAuth } from '@/lib/auth/penilaianAuth';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';
import { buildDateWhereClause, resolveSemesterDateRange } from '@/lib/penilaian/semesterPeriode';
import { getSemesterPeriodeConfig } from '@/lib/penilaian/semesterPeriodeServer';
import { residualZeroConditionSql } from '@/lib/penilaian/nilaiSql';

export const dynamic = 'force-dynamic';

/** Memastikan guru pemilik quick token hanya dapat mengakses santri di kelas yang diampunya. */
async function canGuruAccessMurid(guruId: number | string, muridId: string | number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM murid m
     WHERE m.murid_id = ?
       AND (
         m.kelas_madin_id IN (SELECT kelas_id FROM kelas_madin WHERE guru_id = ? UNION SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
         OR m.kelas_madin_2_id IN (SELECT kelas_id FROM kelas_madin WHERE guru_id = ? UNION SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
       )
     LIMIT 1`,
    [muridId, guruId, guruId, guruId, guruId]
  );
  return rows.length > 0;
}

export async function GET(request: Request) {
  try {
    await ensurePenilaianDB();

    const auth = await resolvePenilaianAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const muridId = searchParams.get('murid_id');
    const semester = searchParams.get('semester') || '1';
    const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';

    if (!muridId) {
      return NextResponse.json({ error: 'Parameter murid_id diperlukan' }, { status: 400 });
    }

    // Batasi akses wali_murid / santri agar hanya dapat mengakses raport santri miliknya sendiri
    if ((auth.role === 'wali_murid' || auth.role === 'santri') && auth.muridId && String(auth.muridId) !== String(muridId)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // Batasi pemilik tautan pintasan guru agar hanya dapat mengakses raport santri di kelasnya
    if (auth.isQuickToken && auth.role === 'guru' && auth.guruId) {
      const allowed = await canGuruAccessMurid(auth.guruId, muridId);
      if (!allowed) {
        return NextResponse.json({ error: 'Santri ini tidak terdaftar pada kelas yang Anda ampu.' }, { status: 403 });
      }
    }

    // 1. Ambil Profil Santri (dukung kelas_madin_id maupun kelas_madin_2_id)
    const [muridRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        m.murid_id, m.nama, m.nis, m.jenis_kelamin,
        COALESCE(m.alamat, '') as alamat,
        COALESCE(
          NULLIF(TRIM(m.nama_wali), ''),
          NULLIF(TRIM((SELECT u.nama FROM users u WHERE u.murid_id = m.murid_id AND u.role = 'wali_murid' LIMIT 1)), ''),
          ''
        ) as nama_wali,
        COALESCE(m.no_wali, '') as no_hp_wali,
        COALESCE(m.foto, '') as foto,
        COALESCE(km.nama_kelas, km2.nama_kelas, '-') as nama_kelas_madin,
        COALESCE(km.nama_kelas, km2.nama_kelas, '-') as tingkat_madin,
        COALESCE(kq.nama_kelas, '-') as nama_kelas_quran,
        COALESCE(k.nama_kamar, '-') as nama_kamar,
        COALESCE(k.nama_asrama, '-') as nama_asrama,
        COALESCE(g.nama, g2.nama, '-') as wali_kelas,
        COALESCE(m.kelas_madin_id, m.kelas_madin_2_id) as kelas_madin_id
      FROM murid m
      LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
      LEFT JOIN guru g ON km.guru_id = g.guru_id
      LEFT JOIN kelas_madin km2 ON m.kelas_madin_2_id = km2.kelas_id
      LEFT JOIN guru g2 ON km2.guru_id = g2.guru_id
      LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
      LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
      WHERE m.murid_id = ?
      LIMIT 1
    `, [muridId]);

    if (muridRows.length === 0) {
      return NextResponse.json({ error: 'Santri tidak ditemukan' }, { status: 404 });
    }
    const santri = muridRows[0];

    // 2. Ambil Nilai Akademik Santri untuk semester & tahun ajaran ini
    let nilaiRows: RowDataPacket[] = [];
    try {
      const [nRows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          id, mata_pelajaran, kitab, nilai_harian, nilai_lisan, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan
        FROM nilai_santri
        WHERE murid_id = ? AND semester = ? AND tahun_ajaran = ?
          AND NOT ${residualZeroConditionSql()}
        ORDER BY mata_pelajaran ASC
      `, [muridId, semester, tahunAjaran]);
      nilaiRows = nRows;
    } catch (nilaiErr) {
      console.warn('Error fetching nilai_santri for raport:', nilaiErr);
    }

    // Selalu ambil seluruh mata pelajaran kelas, lalu gabungkan dengan nilai tersimpan.
    // Dengan begitu mapel yang belum memiliki baris nilai tetap muncul di transkrip.
    let mapelKelasRows: RowDataPacket[] = [];
    if (santri.kelas_madin_id) {
      try {
        const [rows] = await pool.execute<RowDataPacket[]>(`
          SELECT DISTINCT j.mata_pelajaran, COALESCE(k.kitab, '') as kitab
          FROM jadwal_madin j
          LEFT JOIN kurikulum_madin k ON LOWER(TRIM(j.mata_pelajaran)) = LOWER(TRIM(k.mata_pelajaran))
          WHERE j.kelas_madin_id = ? AND j.mata_pelajaran IS NOT NULL AND TRIM(j.mata_pelajaran) != ''
          ORDER BY j.mata_pelajaran ASC
        `, [santri.kelas_madin_id]);
        mapelKelasRows = rows;
      } catch (jadwalErr) {
        console.warn('Error fetching class mapel for raport:', jadwalErr);
      }
    }

    const nilaiByMapel = new Map<string, any>();
    const mapelKey = (name: unknown) => String(name || '').trim().toLocaleLowerCase('id');
    for (const row of mapelKelasRows) {
      const name = String(row.mata_pelajaran || '').trim();
      if (!name) continue;
      const key = mapelKey(name);
      const current = nilaiByMapel.get(key);
      if (!current) {
        nilaiByMapel.set(key, {
          id: `mapel_${nilaiByMapel.size + 1}`,
          mata_pelajaran: name,
          kitab: row.kitab || '',
          nilai_harian: null,
          nilai_lisan: null,
          nilai_uts: null,
          nilai_uas: null,
          nilai_akhir: null,
          predikat: null,
          catatan: '',
        });
      } else if (!current.kitab && row.kitab) {
        current.kitab = row.kitab;
      }
    }

    for (const row of nilaiRows) {
      const name = String(row.mata_pelajaran || '').trim();
      if (!name) continue;
      const key = mapelKey(name);
      const current = nilaiByMapel.get(key);
      if (!current) {
        nilaiByMapel.set(key, { ...row, mata_pelajaran: name });
        continue;
      }

      for (const field of ['kitab', 'nilai_harian', 'nilai_lisan', 'nilai_uts', 'nilai_uas', 'nilai_akhir', 'predikat', 'catatan']) {
        const value = (row as any)[field];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          current[field] = value;
        }
      }
      if (row.id) current.id = row.id;
    }

    nilaiRows = Array.from(nilaiByMapel.values()).sort((a, b) =>
      String(a.mata_pelajaran).localeCompare(String(b.mata_pelajaran), 'id')
    ) as RowDataPacket[];

    // Hitung rata-rata hanya dari mata pelajaran yang memiliki nilai akhir numerik valid
    let totalNilai = 0;
    let scoredMapelCount = 0;
    let mapelDinilaiCount = 0;
    nilaiRows.forEach(n => {
      const hasAnyScore = ['nilai_harian', 'nilai_lisan', 'nilai_uts', 'nilai_uas', 'nilai_akhir'].some((field) => {
        const value = (n as any)[field];
        return value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-';
      });
      if (hasAnyScore) mapelDinilaiCount++;
      const raw = n.nilai_akhir;
      if (raw !== null && raw !== undefined && String(raw).trim() !== '' && String(raw).trim() !== '-') {
        const num = Number(raw);
        if (!isNaN(num)) {
          totalNilai += num;
          scoredMapelCount++;
        }
      }
    });
    const rataRata = scoredMapelCount > 0 ? (totalNilai / scoredMapelCount).toFixed(2) : '0.00';

    // 3. SINKRONISASI OTOMATIS: Rekapitulasi Absensi & Kedisiplinan (mengikuti ketentuan periode semester)
    const periodeConfig = await getSemesterPeriodeConfig();
    const dateRange = resolveSemesterDateRange(semester, tahunAjaran, periodeConfig);
    const absenDate = buildDateWhereClause('tanggal', dateRange);
    const pelDate = buildDateWhereClause('tanggal', dateRange);

    let hadirCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let alphaCount = 0;
    try {
      const [absenRows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          SUM(CASE WHEN LOWER(status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(status) IN ('alpha', 'alpa') OR status = '' OR status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total_sesi
        FROM absensi
        WHERE murid_id = ? ${absenDate.clause}
      `, [muridId, ...absenDate.params]);
      hadirCount = Number(absenRows[0]?.hadir || 0);
      izinCount = Number(absenRows[0]?.izin || 0);
      sakitCount = Number(absenRows[0]?.sakit || 0);
      alphaCount = Number(absenRows[0]?.alpha || 0);
    } catch (absenErr) {
      console.warn('Error fetching absensi for raport:', absenErr);
    }

    const totalAbsensi = hadirCount + izinCount + sakitCount + alphaCount;
    const persentaseHadir = totalAbsensi > 0 ? Math.round((hadirCount / totalAbsensi) * 100) : 100;

    // 3b. Hitung persentase kehadiran per mata pelajaran untuk halaman Transkrip Akademik
    const absenDateJadwal = buildDateWhereClause('a.tanggal', dateRange);
    const perMapelAbsensi = new Map<string, { hadir: number; total: number }>();
    try {
      const [mapelAbsenRows] = await pool.execute<RowDataPacket[]>(`
        SELECT
          jm.mata_pelajaran,
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          COUNT(*) as total_sesi
        FROM absensi a
        JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
        WHERE a.murid_id = ?
          AND jm.mata_pelajaran IS NOT NULL
          AND TRIM(jm.mata_pelajaran) != ''
          ${absenDateJadwal.clause}
        GROUP BY jm.mata_pelajaran
      `, [muridId, ...absenDateJadwal.params]);

      for (const row of mapelAbsenRows) {
        const key = mapelKey(row.mata_pelajaran);
        if (!key) continue;
        const prev = perMapelAbsensi.get(key) || { hadir: 0, total: 0 };
        perMapelAbsensi.set(key, {
          hadir: prev.hadir + Number(row.hadir || 0),
          total: prev.total + Number(row.total_sesi || 0),
        });
      }
    } catch (mapelAbsenErr) {
      console.warn('Error fetching per-mapel absensi for raport:', mapelAbsenErr);
    }

    nilaiRows = nilaiRows.map((row) => {
      const att = perMapelAbsensi.get(mapelKey(row.mata_pelajaran));
      const total = att?.total ?? 0;
      const hadir = att?.hadir ?? 0;
      return {
        ...row,
        kehadiran_hadir: hadir,
        kehadiran_total: total,
        kehadiran_persen: total > 0 ? Math.round((hadir / total) * 100) : null,
      };
    }) as RowDataPacket[];

    // 4. SINKRONISASI OTOMATIS: Catatan Kedisiplinan / Ketertiban (tabel pelanggaran: pelanggaran_id, murid_id, jenis, deskripsi, tanggal)
    let pelanggaranRows: RowDataPacket[] = [];
    try {
      const [pRows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          pelanggaran_id, jenis, deskripsi, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal
        FROM pelanggaran
        WHERE murid_id = ? ${pelDate.clause}
        ORDER BY tanggal DESC
        LIMIT 10
      `, [muridId, ...pelDate.params]);
      pelanggaranRows = pRows;
    } catch (pelErr) {
      console.warn('Error fetching pelanggaran for raport:', pelErr);
    }

    let totalPoinPelanggaran = 0;
    pelanggaranRows.forEach(p => {
      totalPoinPelanggaran += Number((p as any).poin || 0);
    });

    // Predikat Kedisiplinan Otomatis
    let predikatKedisiplinan = 'Sangat Baik';
    if (totalPoinPelanggaran > 50 || pelanggaranRows.length >= 5) predikatKedisiplinan = 'Kurang (Perlu Pembinaan)';
    else if (totalPoinPelanggaran > 25 || pelanggaranRows.length >= 3) predikatKedisiplinan = 'Cukup';
    else if (totalPoinPelanggaran > 10 || pelanggaranRows.length >= 1) predikatKedisiplinan = 'Baik';

    // 5. Ambil Catatan Raport & Kepribadian (raport_catatan)
    let catatanRows: RowDataPacket[] = [];
    try {
      const [cRows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          catatan_wali_kelas, akhlak, kerajinan, kebersihan, tahfidz_hafalan, status_kelulusan
        FROM raport_catatan
        WHERE murid_id = ? AND semester = ? AND tahun_ajaran = ?
        LIMIT 1
      `, [muridId, semester, tahunAjaran]);
      catatanRows = cRows;
    } catch (catErr) {
      console.warn('Error fetching raport_catatan:', catErr);
    }

    const catatan = catatanRows[0] || {
      catatan_wali_kelas: 'Tingkatkan terus semangat belajar dan ibadah, pertahankan prestasi yang telah diraih.',
      akhlak: 'Baik',
      kerajinan: 'Baik',
      kebersihan: 'Baik',
      tahfidz_hafalan: 'Juz 30 (Al-A\'la - An-Nas)',
      status_kelulusan: semester === '2' ? 'Naik Kelas' : 'Lanjut ke Semester Berikutnya',
    };

    // 6. Sinkronisasi Nama Kepala Madin dari pengaturan "Semua Madin" (kepala_madin_all_id) di halaman notifikasi
    let kepalaMadinNama = 'Agus Naqoub Ashrofun Nasr';
    try {
      const [kmRows] = await pool.execute<RowDataPacket[]>(
        "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = 'kepala_madin_all_id' LIMIT 1"
      );
      const targetGid = kmRows.length > 0 ? kmRows[0].nilai : '';
      if (targetGid) {
        const [guruRows] = await pool.execute<RowDataPacket[]>(
          'SELECT nama FROM guru WHERE guru_id = ? LIMIT 1', [targetGid]
        );
        if (guruRows.length > 0 && guruRows[0].nama) kepalaMadinNama = guruRows[0].nama;
      }
    } catch (kmErr) {
      console.warn('Error fetching kepala madin name for raport:', kmErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        santri,
        semester,
        tahun_ajaran: tahunAjaran,
        nilai: nilaiRows,
        ringkasan_nilai: {
          total_mapel: nilaiRows.length,
          total_mapel_dinilai: mapelDinilaiCount,
          total_nilai_akhir: scoredMapelCount,
          rata_rata: rataRata,
        },
        rekap_absensi: {
          hadir: hadirCount,
          izin: izinCount,
          sakit: sakitCount,
          alpha: alphaCount,
          total: totalAbsensi,
          persentase: persentaseHadir,
        },
        rekap_kedisiplinan: {
          total_poin: totalPoinPelanggaran,
          predikat: predikatKedisiplinan,
          riwayat: pelanggaranRows,
        },
        catatan,
        kepala_madin: kepalaMadinNama,
        periode_filter: dateRange
          ? { mode: dateRange.mode, start_date: dateRange.startDate || null, end_date: dateRange.endDate || null }
          : { mode: periodeConfig.periode_filter_mode, start_date: null, end_date: null },
      },
    });
  } catch (error: any) {
    console.error('Error in /api/penilaian/raport:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensurePenilaianDB();

    const body = await request.json();
    const auth = await resolvePenilaianAuth(request, {
      bodyToken: body?.token,
      allowedRoles: ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'],
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const {
      murid_id,
      semester,
      tahun_ajaran,
      catatan_wali_kelas,
      akhlak,
      kerajinan,
      kebersihan,
      tahfidz_hafalan,
      status_kelulusan,
    } = body;

    if (!murid_id || !semester || !tahun_ajaran) {
      return NextResponse.json({ error: 'Data raport tidak lengkap' }, { status: 400 });
    }

    if (auth.isQuickToken && auth.role === 'guru' && auth.guruId) {
      const allowed = await canGuruAccessMurid(auth.guruId, murid_id);
      if (!allowed) {
        return NextResponse.json({ error: 'Santri ini tidak terdaftar pada kelas yang Anda ampu.' }, { status: 403 });
      }
    }

    await pool.execute(`
      INSERT INTO raport_catatan 
        (murid_id, semester, tahun_ajaran, catatan_wali_kelas, akhlak, kerajinan, kebersihan, tahfidz_hafalan, status_kelulusan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        catatan_wali_kelas = VALUES(catatan_wali_kelas),
        akhlak = VALUES(akhlak),
        kerajinan = VALUES(kerajinan),
        kebersihan = VALUES(kebersihan),
        tahfidz_hafalan = VALUES(tahfidz_hafalan),
        status_kelulusan = VALUES(status_kelulusan),
        updated_at = CURRENT_TIMESTAMP
    `, [
      murid_id,
      semester,
      tahun_ajaran,
      catatan_wali_kelas || null,
      akhlak || 'Baik',
      kerajinan || 'Baik',
      kebersihan || 'Baik',
      tahfidz_hafalan || null,
      status_kelulusan || 'Naik Kelas',
    ]);

    return NextResponse.json({
      success: true,
      message: 'Catatan raport berhasil disimpan.',
    });
  } catch (error: any) {
    console.error('Error in POST /api/penilaian/raport:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
