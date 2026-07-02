/**
 * /api/sync/googlesheet/route.ts
 * Endpoint utama sinkronisasi 1-arah dari MySQL ke Google Sheets.
 * 
 * POST /api/sync/googlesheet
 * 
 * Dilindungi dengan Authorization: Bearer {CRON_SECRET}
 * atau token JWT pengguna yang valid (untuk trigger manual dari dashboard).
 * 
 * Perilaku Sinkronisasi:
 * - Data Master (Santri, Guru, Jadwal): OVERWRITE (selalu sama persis dengan DB)
 * - Data Log (Rekap Absensi, Ketertiban): APPEND UNIQUE (histori tersimpan)
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { overwriteSheet, appendSheetUnique } from '@/lib/googleSheets';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

// Helper: format tanggal ke string lokal Indonesia
function formatTanggal(val: any): string {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return String(val);
  }
}

export async function POST(request: Request) {
  try {
    // === AUTENTIKASI ===
    // Cek apakah request datang dari Cron (via Authorization header)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    let isAuthorized = false;

    if (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true;
    } else {
      // Atau dari user yang login (manual trigger dari dashboard)
      const cookieStore = await cookies();
      const token = cookieStore.get('token')?.value;
      if (token) {
        const payload = verifyToken(token) as any;
        if (payload && (payload.role === 'admin' || payload.role === 'staff')) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: Record<string, any> = {};

    // ================================================================
    // TAB 1: Data_Santri — OVERWRITE
    // ================================================================
    try {
      const [santriRows] = await pool.execute<RowDataPacket[]>(`
        SELECT 
          m.nis, m.nama,
          m.jenis_kelamin,
          km.nama_kelas as kelas_madin,
          kq.nama_kelas as kelas_quran,
          k.nama_kamar as kamar,
          k.nama_asrama as asrama,
          m.no_hp, m.nama_wali, m.alamat
        FROM murid m
        LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
        LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
        LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
        ORDER BY m.nama ASC
      `);

      const header = ['NIS', 'Nama', 'Jenis Kelamin', 'Kelas Madin', 'Kelas Qur\'an', 'Kamar', 'Asrama', 'No HP', 'Nama Wali', 'Alamat'];
      const rows = santriRows.map(r => [
        r.nis || '', r.nama || '', r.jenis_kelamin || '',
        r.kelas_madin || '', r.kelas_quran || '', r.kamar || '',
        r.asrama || '', r.no_hp || '', r.nama_wali || '', r.alamat || ''
      ]);
      const res = await overwriteSheet('Data_Santri', [header, ...rows]);
      results.santri = { status: 'ok', rows: res.rowsWritten - 1 };
    } catch (e: any) {
      results.santri = { status: 'error', message: e.message };
    }

    // ================================================================
    // TAB 2: Data_Guru — OVERWRITE
    // ================================================================
    try {
      const [guruRows] = await pool.execute<RowDataPacket[]>(`
        SELECT guru_id, nip, nama, jenis_kelamin, jabatan, no_hp, alamat
        FROM guru
        ORDER BY nama ASC
      `);

      const header = ['ID', 'NIP', 'Nama', 'Jenis Kelamin', 'Jabatan', 'No HP', 'Alamat'];
      const rows = guruRows.map(r => [
        r.guru_id || '', r.nip || '', r.nama || '',
        r.jenis_kelamin || '', r.jabatan || '',
        r.no_hp || '', r.alamat || ''
      ]);
      const res = await overwriteSheet('Data_Guru', [header, ...rows]);
      results.guru = { status: 'ok', rows: res.rowsWritten - 1 };
    } catch (e: any) {
      results.guru = { status: 'error', message: e.message };
    }

    // ================================================================
    // TAB 3: Jadwal — OVERWRITE
    // ================================================================
    try {
      const [jadwalMadin] = await pool.execute<RowDataPacket[]>(`
        SELECT 'Madin' as tipe_kelas, g.nama as nama_guru, km.nama_kelas as nama_kelas,
               jm.hari, jm.jam_mulai, jm.jam_selesai
        FROM jadwal_madin jm
        LEFT JOIN guru g ON jm.guru_id = g.guru_id
        LEFT JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
        ORDER BY jm.hari, jm.jam_mulai
      `);
      const [jadwalQuran] = await pool.execute<RowDataPacket[]>(`
        SELECT "Qur'an" as tipe_kelas, g.nama as nama_guru, kq.nama_kelas as nama_kelas,
               jq.hari, jq.jam_mulai, jq.jam_selesai
        FROM jadwal_quran jq
        LEFT JOIN guru g ON jq.guru_id = g.guru_id
        LEFT JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
        ORDER BY jq.hari, jq.jam_mulai
      `);
      const [jadwalKegiatan] = await pool.execute<RowDataPacket[]>(`
        SELECT 'Kegiatan' as tipe_kelas, g.nama as nama_guru, k.nama_kamar as nama_kelas,
               jk.hari, jk.jam_mulai, jk.jam_selesai
        FROM jadwal_kegiatan jk
        LEFT JOIN guru g ON jk.guru_id = g.guru_id
        LEFT JOIN kamar k ON jk.kamar_id = k.kamar_id
        ORDER BY jk.hari, jk.jam_mulai
      `);

      const allJadwal = [...jadwalMadin as any[], ...jadwalQuran as any[], ...jadwalKegiatan as any[]];
      const header = ['Tipe', 'Nama Guru', 'Kelas/Kamar', 'Hari', 'Jam Mulai', 'Jam Selesai'];
      const rows = allJadwal.map(r => [
        r.tipe_kelas || '', r.nama_guru || '', r.nama_kelas || '',
        r.hari || '', r.jam_mulai || '', r.jam_selesai || ''
      ]);
      const res = await overwriteSheet('Jadwal', [header, ...rows]);
      results.jadwal = { status: 'ok', rows: res.rowsWritten - 1 };
    } catch (e: any) {
      results.jadwal = { status: 'error', message: e.message };
    }

    // ================================================================
    // TAB 4: Rekap_Absensi — APPEND UNIQUE
    // Kunci unik: Tanggal + Nama + Tipe (agar tidak duplikat saat re-sync)
    // ================================================================
    try {
      // Rekap Madin (30 hari terakhir)
      const [absensiMadin] = await pool.execute<RowDataPacket[]>(`
        SELECT m.nis, m.nama, 'Madin' as tipe,
               DATE_FORMAT(a.tanggal, '%d/%m/%Y') as tanggal,
               a.status,
               km.nama_kelas as kelas
        FROM absensi a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
        WHERE a.tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY a.tanggal DESC, m.nama ASC
      `);
      // Rekap Quran (30 hari terakhir)
      const [absensiQuran] = await pool.execute<RowDataPacket[]>(`
        SELECT m.nis, m.nama, "Qur'an" as tipe,
               DATE_FORMAT(a.tanggal, '%d/%m/%Y') as tanggal,
               a.status,
               kq.nama_kelas as kelas
        FROM absensi_quran a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
        WHERE a.tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY a.tanggal DESC, m.nama ASC
      `);
      // Rekap Kegiatan (30 hari terakhir)
      const [absensiKegiatan] = await pool.execute<RowDataPacket[]>(`
        SELECT m.nis, m.nama, 'Kegiatan' as tipe,
               DATE_FORMAT(a.tanggal, '%d/%m/%Y') as tanggal,
               a.status,
               k.nama_kamar as kelas
        FROM absensi_kegiatan a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
        WHERE a.tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY a.tanggal DESC, m.nama ASC
      `);
      // Rekap Absensi Guru (30 hari terakhir)
      const [absensiGuru] = await pool.execute<RowDataPacket[]>(`
        SELECT g.nip as nis, g.nama, 'Guru' as tipe,
               DATE_FORMAT(a.tanggal, '%d/%m/%Y') as tanggal,
               a.status, '' as kelas
        FROM absensi_guru a
        JOIN guru g ON a.guru_id = g.guru_id
        WHERE a.tanggal >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY a.tanggal DESC, g.nama ASC
      `);

      const allAbsensi = [
        ...(absensiMadin as any[]),
        ...(absensiQuran as any[]),
        ...(absensiKegiatan as any[]),
        ...(absensiGuru as any[])
      ];

      const header = ['NIS/NIP', 'Nama', 'Tipe', 'Tanggal', 'Status', 'Kelas/Kamar'];
      const rows = allAbsensi.map(r => [
        r.nis || '', r.nama || '', r.tipe || '',
        r.tanggal || '', r.status || '', r.kelas || ''
      ]);
      // Kunci unik: kolom 1 (Nama) + kolom 2 (Tipe) + kolom 3 (Tanggal)
      const res = await appendSheetUnique('Rekap_Absensi', header, rows, [0, 2, 3]);
      results.absensi = { status: 'ok', appended: res.appended, skipped: res.skipped };
    } catch (e: any) {
      results.absensi = { status: 'error', message: e.message };
    }

    // ================================================================
    // TAB 5: Ketertiban — APPEND UNIQUE
    // Kunci unik: ID pelanggaran (kolom 0)
    // ================================================================
    try {
      const [ketertibanRows] = await pool.execute<RowDataPacket[]>(`
        SELECT p.pelanggaran_id, m.nis, m.nama,
               DATE_FORMAT(p.tanggal, '%d/%m/%Y') as tanggal,
               p.jenis, p.deskripsi
        FROM pelanggaran p
        JOIN murid m ON p.murid_id = m.murid_id
        WHERE p.tanggal >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        ORDER BY p.tanggal DESC
      `);

      const header = ['ID', 'NIS', 'Nama Santri', 'Tanggal', 'Jenis', 'Keterangan'];
      const rows = (ketertibanRows as any[]).map(r => [
        r.pelanggaran_id || '', r.nis || '', r.nama || '',
        r.tanggal || '', r.jenis || '', r.deskripsi || ''
      ]);
      // Kunci unik: kolom 0 (pelanggaran_id)
      const res = await appendSheetUnique('Ketertiban', header, rows, [0]);
      results.ketertiban = { status: 'ok', appended: res.appended, skipped: res.skipped };
    } catch (e: any) {
      results.ketertiban = { status: 'error', message: e.message };
    }

    // ================================================================
    // Simpan waktu sinkronisasi terakhir ke database
    // ================================================================
    const nowStr = new Date().toISOString();
    try {
      await pool.execute(
        `INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) 
         VALUES ('terakhir_sync_gsheet', ?) 
         ON DUPLICATE KEY UPDATE nilai = ?`,
        [nowStr, nowStr]
      );
    } catch {
      // Abaikan error simpan log — jangan gagalkan seluruh proses
    }

    // Hitung berapa tab yang sukses
    const successCount = Object.values(results).filter((r: any) => r.status === 'ok').length;
    const totalTabs = Object.keys(results).length;

    return NextResponse.json({
      success: successCount === totalTabs,
      message: `Sinkronisasi selesai: ${successCount}/${totalTabs} tab berhasil`,
      synced_at: nowStr,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}`,
      results,
    });

  } catch (error: any) {
    console.error('Error Google Sheets Sync:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal sinkronisasi: ' + error.message },
      { status: 500 }
    );
  }
}
