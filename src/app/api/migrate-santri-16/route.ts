import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/migrate-santri-16
 * One-time migration: update & insert 9 santri dari data rekan tim
 * (hasil audit 25_SANTRI_BELUM_ADA_DB_ISI_NIM_SEBAGIAN.xlsx)
 * Safe untuk dijalankan berulang (idempotent).
 */
export async function GET() {
  try {
    const results: any[] = [];

    // ─── STEP 1: Update kelas 7 santri yang sudah ada di DB ───────────────
    const updates = [
      { nis: '2024070669', kelas_id: 14, kelas: '1 WUSTHO (A) PUTRI' },
      { nis: '2025070185', kelas_id: 3,  kelas: '2 WUSTHO (A) PUTRA' },
      { nis: '2024070623', kelas_id: 31, kelas: '3 ULA (B) PUTRI' },
      { nis: '2024070631', kelas_id: 32, kelas: '3 ULA (C) PUTRI' },
      { nis: '2024070043', kelas_id: 21, kelas: '3 WUSTHO (A) PUTRI' },
      { nis: '2025070470', kelas_id: 27, kelas: '2 ULA (A) PUTRI' },
      { nis: '2025070210', kelas_id: 19, kelas: '2 WUSTHO (B) PUTRI' },
    ];

    for (const u of updates) {
      const [rows]: any = await pool.execute(
        'SELECT murid_id, nama, kelas_madin_id FROM murid WHERE nis = ?', [u.nis]
      );
      if (rows.length === 0) {
        results.push({ nis: u.nis, status: 'NOT_FOUND' });
        continue;
      }
      if (rows[0].kelas_madin_id === u.kelas_id) {
        results.push({ nis: u.nis, nama: rows[0].nama, status: 'ALREADY_CORRECT', kelas: u.kelas });
        continue;
      }
      await pool.execute('UPDATE murid SET kelas_madin_id = ?, updated_at = NOW() WHERE nis = ?', [u.kelas_id, u.nis]);
      results.push({ nis: u.nis, nama: rows[0].nama, status: 'UPDATED', kelas_baru: u.kelas });
    }

    // ─── STEP 2: Insert 2 santri baru ─────────────────────────────────────
    const inserts = [
      { nis: '2026060161', nama: 'SHELSYA KANNAH CYBIELLAH', gender: 'Perempuan', kelas_id: 16, kelas: '1 WUSTHO (C) PUTRI' },
      { nis: '2026060162', nama: 'TSANIYAH NAILATUL IZZA',   gender: 'Perempuan', kelas_id: 16, kelas: '1 WUSTHO (C) PUTRI' },
    ];

    for (const ins of inserts) {
      const [existing]: any = await pool.execute('SELECT murid_id FROM murid WHERE nis = ?', [ins.nis]);
      if (existing.length > 0) {
        results.push({ nis: ins.nis, nama: ins.nama, status: 'ALREADY_EXISTS' });
        continue;
      }
      const [result]: any = await pool.execute(
        'INSERT INTO murid (nama, nis, jenis_kelamin, kelas_madin_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [ins.nama, ins.nis, ins.gender, ins.kelas_id]
      );
      results.push({ nis: ins.nis, nama: ins.nama, status: 'INSERTED', murid_id: result.insertId, kelas: ins.kelas });
    }

    const updated  = results.filter(r => r.status === 'UPDATED').length;
    const inserted = results.filter(r => r.status === 'INSERTED').length;
    const correct  = results.filter(r => r.status === 'ALREADY_CORRECT' || r.status === 'ALREADY_EXISTS').length;

    return NextResponse.json({
      success: true,
      message: `Migrasi selesai: ${updated} diupdate, ${inserted} diinsert, ${correct} sudah benar`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
