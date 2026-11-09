import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';

export const dynamic = 'force-dynamic';

// GET /api/ujian/hasil?ujian_id=X — Daftar hasil ujian semua peserta (guru/admin)
export async function GET(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, muridId } = payload;
    const userRoleLower = (role || '').toLowerCase();

    // Santri hanya bisa lihat hasil miliknya sendiri
    const isSantriRole = userRoleLower === 'santri' || userRoleLower === 'wali_murid' || userRoleLower === 'wali_alumni';
    const isGuruRole = userRoleLower === 'guru';
    const isAdminStaff = ['admin', 'staff'].includes(userRoleLower);

    if (!isSantriRole && !isGuruRole && !isAdminStaff) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ujian_id = searchParams.get('ujian_id');

    if (!ujian_id) {
      return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });
    }

    // Ambil info ujian & cek akses guru
    const [ujianRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, judul, mata_pelajaran, kelas_madin_id, guru_id, jenis_ujian, passing_grade FROM ujian_madin WHERE id = ? LIMIT 1',
      [ujian_id]
    );
    if (ujianRows.length === 0) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }
    const ujian = ujianRows[0];

    // Guru hanya bisa lihat ujian miliknya
    if (isGuruRole && guruId && ujian.guru_id && Number(ujian.guru_id) !== Number(guruId)) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke hasil ujian ini.' }, { status: 403 });
    }

    // Santri/wali hanya lihat hasil diri sendiri
    if (isSantriRole) {
      if (!muridId) return NextResponse.json({ error: 'Data santri tidak ditemukan.' }, { status: 400 });
      const [hasilSantri] = await pool.execute<RowDataPacket[]>(
        `SELECT h.*, m.nama_lengkap, m.nis
         FROM ujian_hasil_santri h
         LEFT JOIN murid m ON h.murid_id = m.id
         WHERE h.ujian_id = ? AND h.murid_id = ?
         LIMIT 1`,
        [ujian_id, muridId]
      );
      return NextResponse.json({
        ujian,
        hasil: hasilSantri[0] || null,
        total_peserta: hasilSantri.length,
      });
    }

    // Admin/staff/guru: lihat semua hasil peserta
    const [hasilRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         h.id,
         h.murid_id,
         h.skor_akhir,
         h.jumlah_benar,
         h.jumlah_salah,
         h.total_soal,
         h.status_lulus,
         h.durasi_detik,
         h.waktu_mulai,
         h.waktu_selesai,
         h.lokasi_lat,
         h.lokasi_lng,
         h.ip_address,
         h.device_info,
         m.nama_lengkap,
         m.nis,
         k.nama_kelas
       FROM ujian_hasil_santri h
       LEFT JOIN murid m ON h.murid_id = m.id
       LEFT JOIN kelas_madin k ON m.kelas_madin_id = k.id
       WHERE h.ujian_id = ?
       ORDER BY h.skor_akhir DESC, h.waktu_selesai ASC`,
      [ujian_id]
    );

    // Hitung statistik ringkas
    const totalPeserta = hasilRows.length;
    const totalLulus = hasilRows.filter((r: any) => r.status_lulus).length;
    const avgSkor = totalPeserta > 0
      ? Math.round(hasilRows.reduce((sum: number, r: any) => sum + Number(r.skor_akhir), 0) / totalPeserta * 100) / 100
      : 0;
    const nilaiTertinggi = totalPeserta > 0 ? Math.max(...hasilRows.map((r: any) => Number(r.skor_akhir))) : 0;
    const nilaiTerendah = totalPeserta > 0 ? Math.min(...hasilRows.map((r: any) => Number(r.skor_akhir))) : 0;

    return NextResponse.json({
      ujian,
      hasil: hasilRows,
      statistik: {
        total_peserta: totalPeserta,
        total_lulus: totalLulus,
        total_tidak_lulus: totalPeserta - totalLulus,
        persentase_lulus: totalPeserta > 0 ? Math.round((totalLulus / totalPeserta) * 100) : 0,
        rata_rata_skor: avgSkor,
        nilai_tertinggi: nilaiTertinggi,
        nilai_terendah: nilaiTerendah,
      },
    });
  } catch (error: any) {
    console.error('Error GET /api/ujian/hasil:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
