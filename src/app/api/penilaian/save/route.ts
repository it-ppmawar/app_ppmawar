import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const body = await request.json();
    const { kelas_id, mata_pelajaran, kitab, semester, tahun_ajaran, kurikulum_id, scores } = body;

    if (!kelas_id || !mata_pelajaran || !semester || !tahun_ajaran || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'Data penilaian tidak lengkap' }, { status: 400 });
    }

    if (mata_pelajaran === 'SEMUA' || mata_pelajaran === 'Semua Mapel') {
      return NextResponse.json({ error: 'Silakan pilih salah satu mata pelajaran spesifik untuk menyimpan nilai.' }, { status: 400 });
    }

    const calcPredikat = (score: number) => {
      if (score >= 90) return 'A';
      if (score >= 80) return 'B';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'E';
    };

    // Upsert setiap nilai dengan dukungan manual override dari guru
    for (const item of scores) {
      if (!item.murid_id) continue;

      const harian = item.nilai_harian !== null && item.nilai_harian !== '' ? Number(item.nilai_harian) : 0;
      const uts = item.nilai_uts !== null && item.nilai_uts !== '' ? Number(item.nilai_uts) : 0;
      const uas = item.nilai_uas !== null && item.nilai_uas !== '' ? Number(item.nilai_uas) : 0;

      // Fleksibilitas: Jika pengguna/guru mengisi atau mengubah nilai_akhir secara manual, gunakan nilai manual tersebut.
      // Jika tidak diisi manual, gunakan kalkulasi otomatis 30% Harian + 30% UTS + 40% UAS.
      let nilaiAkhir = 0;
      if (item.nilai_akhir !== null && item.nilai_akhir !== undefined && item.nilai_akhir !== '') {
        nilaiAkhir = Number(item.nilai_akhir);
      } else if (item.nilai_harian !== null || item.nilai_uts !== null || item.nilai_uas !== null) {
        nilaiAkhir = Math.round((harian * 0.3 + uts * 0.3 + uas * 0.4) * 100) / 100;
      }

      // Predikat: gunakan predikat yang diubah manual guru jika ada, atau hitung otomatis
      const predikat = item.predikat ? String(item.predikat).trim().toUpperCase() : calcPredikat(nilaiAkhir);

      await pool.execute(`
        INSERT INTO nilai_santri 
          (murid_id, kelas_madin_id, kurikulum_id, mata_pelajaran, kitab, semester, tahun_ajaran, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan, guru_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          kelas_madin_id = VALUES(kelas_madin_id),
          kurikulum_id = VALUES(kurikulum_id),
          kitab = VALUES(kitab),
          nilai_harian = VALUES(nilai_harian),
          nilai_uts = VALUES(nilai_uts),
          nilai_uas = VALUES(nilai_uas),
          nilai_akhir = VALUES(nilai_akhir),
          predikat = VALUES(predikat),
          catatan = VALUES(catatan),
          guru_id = VALUES(guru_id),
          updated_at = CURRENT_TIMESTAMP
      `, [
        item.murid_id,
        kelas_id,
        kurikulum_id || null,
        mata_pelajaran,
        kitab || null,
        semester,
        tahun_ajaran,
        harian,
        uts,
        uas,
        nilaiAkhir,
        predikat,
        item.catatan || null,
        payload.userId || null
      ]);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyimpan nilai untuk ${scores.length} santri.`,
    });
  } catch (error: any) {
    console.error('Error in /api/penilaian/save:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
