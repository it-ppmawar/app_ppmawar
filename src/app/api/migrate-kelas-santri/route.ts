import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/migrate-kelas-santri
 * One-time migration: update kelas_madin_id for 8 santri yang kelasnya
 * perlu disesuaikan berdasarkan hasil audit jadwal madin 2026-2027.
 * 
 * Hanya jalankan 1x di production cPanel melalui browser.
 * Endpoint ini safe untuk diulang karena menggunakan WHERE nis = ?
 */
export async function GET() {
  try {
    const updates = [
      // Santri yang perlu diupdate kelasnya
      { nis: '2025070280', nama: 'M. MARCEL AULIA WICAKSANA',         kelas_baru: '2 WUSTHO (A) PUTRA', kelas_id: 3  },
      { nis: '2025070411', nama: 'AURA HANNA ZILFAH DLOFWATUL AISY',  kelas_baru: '2 WUSTHO (A) PUTRI', kelas_id: 18 },
    ];

    const results: any[] = [];

    for (const u of updates) {
      const [rows]: any = await pool.execute(
        'SELECT murid_id, nama, nis, kelas_madin_id, (SELECT nama_kelas FROM kelas_madin WHERE kelas_id = murid.kelas_madin_id) AS kelas_lama FROM murid WHERE nis = ?',
        [u.nis]
      );

      if (rows.length === 0) {
        results.push({ nis: u.nis, status: 'NOT_FOUND', message: `Santri NIS ${u.nis} tidak ditemukan di database` });
        continue;
      }

      const r = rows[0];
      if (r.kelas_madin_id === u.kelas_id) {
        results.push({ nis: u.nis, nama: r.nama, status: 'ALREADY_CORRECT', kelas: u.kelas_baru });
        continue;
      }

      await pool.execute(
        'UPDATE murid SET kelas_madin_id = ?, updated_at = NOW() WHERE nis = ?',
        [u.kelas_id, u.nis]
      );

      results.push({
        nis: u.nis,
        nama: r.nama,
        status: 'UPDATED',
        kelas_lama: r.kelas_lama || '(NULL)',
        kelas_baru: u.kelas_baru
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Migrasi kelas madin 8 santri selesai',
      total_diproses: updates.length,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
