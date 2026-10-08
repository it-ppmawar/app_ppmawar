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
    const muridId = searchParams.get('murid_id');
    const semester = searchParams.get('semester') || '1';
    const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';

    if (!muridId) {
      return NextResponse.json({ error: 'Parameter murid_id diperlukan' }, { status: 400 });
    }

    // 1. Ambil Profil Santri
    const [muridRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        m.murid_id, m.nama, m.nis, m.jenis_kelamin, m.nama_wali, m.no_hp_wali,
        COALESCE(m.foto, '') as foto,
        COALESCE(km.nama_kelas, '-') as nama_kelas_madin,
        COALESCE(km.nama_kelas, '-') as tingkat_madin,
        COALESCE(kq.nama_kelas, '-') as nama_kelas_quran,
        COALESCE(k.nama_kamar, '-') as nama_kamar,
        COALESCE(k.nama_asrama, '-') as nama_asrama,
        COALESCE(g.nama, '-') as wali_kelas
      FROM murid m
      LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
      LEFT JOIN guru g ON km.guru_id = g.guru_id
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
    const [nilaiRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        id, mata_pelajaran, kitab, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan
      FROM nilai_santri
      WHERE murid_id = ? AND semester = ? AND tahun_ajaran = ?
      ORDER BY mata_pelajaran ASC
    `, [muridId, semester, tahunAjaran]);

    // Hitung rata-rata nilai akhir
    let totalNilai = 0;
    nilaiRows.forEach(n => {
      totalNilai += Number(n.nilai_akhir || 0);
    });
    const rataRata = nilaiRows.length > 0 ? (totalNilai / nilaiRows.length).toFixed(2) : '0.00';

    // 3. SINKRONISASI OTOMATIS: Rekapitulasi Absensi dari database
    const [absenRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        SUM(CASE WHEN LOWER(status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN LOWER(status) = 'izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN LOWER(status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN LOWER(status) IN ('alpha', 'alpa') OR status = '' OR status IS NULL THEN 1 ELSE 0 END) as alpha,
        COUNT(*) as total_sesi
      FROM absensi
      WHERE murid_id = ?
    `, [muridId]);

    const hadirCount = Number(absenRows[0]?.hadir || 0);
    const izinCount = Number(absenRows[0]?.izin || 0);
    const sakitCount = Number(absenRows[0]?.sakit || 0);
    const alphaCount = Number(absenRows[0]?.alpha || 0);
    const totalAbsensi = hadirCount + izinCount + sakitCount + alphaCount;
    const persentaseHadir = totalAbsensi > 0 ? Math.round((hadirCount / totalAbsensi) * 100) : 100;

    // 4. SINKRONISASI OTOMATIS: Catatan Kedisiplinan / Ketertiban
    const [pelanggaranRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        pelanggaran_id, jenis, poin, deskripsi, tindakan, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal
      FROM pelanggaran
      WHERE murid_id = ?
      ORDER BY tanggal DESC
      LIMIT 10
    `, [muridId]);

    let totalPoinPelanggaran = 0;
    pelanggaranRows.forEach(p => {
      totalPoinPelanggaran += Number(p.poin || 0);
    });

    // Predikat Kedisiplinan Otomatis
    let predikatKedisiplinan = 'Sangat Baik';
    if (totalPoinPelanggaran > 50) predikatKedisiplinan = 'Kurang (Perlu Pembinaan)';
    else if (totalPoinPelanggaran > 25) predikatKedisiplinan = 'Cukup';
    else if (totalPoinPelanggaran > 10) predikatKedisiplinan = 'Baik';

    // 5. Ambil Catatan Raport & Kepribadian (raport_catatan)
    const [catatanRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        catatan_wali_kelas, akhlak, kerajinan, kebersihan, tahfidz_hafalan, status_kelulusan
      FROM raport_catatan
      WHERE murid_id = ? AND semester = ? AND tahun_ajaran = ?
      LIMIT 1
    `, [muridId, semester, tahunAjaran]);

    const catatan = catatanRows[0] || {
      catatan_wali_kelas: 'Tingkatkan terus semangat belajar dan ibadah, pertahankan prestasi yang telah diraih.',
      akhlak: 'Baik',
      kerajinan: 'Baik',
      kebersihan: 'Baik',
      tahfidz_hafalan: 'Juz 30 (Al-A\'la - An-Nas)',
      status_kelulusan: semester === '2' ? 'Naik Kelas' : 'Lanjut ke Semester Berikutnya',
    };

    return NextResponse.json({
      success: true,
      data: {
        santri,
        semester,
        tahun_ajaran: tahunAjaran,
        nilai: nilaiRows,
        ringkasan_nilai: {
          total_mapel: nilaiRows.length,
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

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const body = await request.json();
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
