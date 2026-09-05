import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';

// Helper untuk normalisasi nama pencocokan
function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Ekstrak detail kontak & profil tambahan dari sheet individual jika ada
function extractExtraProfiles(wb: xlsx.WorkBook): Map<string, any> {
  const profileMap = new Map<string, any>();

  const sheetsToScan = ['TK', 'MI.BANIN', 'MI.BANAT', 'MTS', 'SMP', 'SMK', 'MA', 'SMKUpdate'];
  for (const sName of sheetsToScan) {
    const sheet = wb.Sheets[sName];
    if (!sheet) continue;
    const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (!rows || rows.length === 0) continue;

    let headerIdx = -1;
    let colName = 1;
    let colPhone = -1;
    let colAddress = -1;
    let colTtl = -1;
    let colIbu = -1;
    let colPendidikan = -1;
    let colStatus = -1;

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r];
      if (!row) continue;
      const rowStr = row.map(c => String(c || '').toLowerCase());
      if (rowStr.some(c => c.includes('nama') || c === 'nama')) {
        headerIdx = r;
        rowStr.forEach((cell, idx) => {
          if (cell === 'nama' || cell.includes('nama dewan') || cell.includes('nama guru')) colName = idx;
          else if (cell.includes('hp') || cell.includes('telp') || cell.includes('wa')) colPhone = idx;
          else if (cell.includes('alamat')) colAddress = idx;
          else if (cell.includes('ttl') || cell.includes('tempat') || cell.includes('tgl')) colTtl = idx;
          else if (cell.includes('ibu')) colIbu = idx;
          else if (cell.includes('pend') || cell.includes('jurusan')) colPendidikan = idx;
          else if (cell.includes('status')) colStatus = idx;
        });
        break;
      }
    }

    if (headerIdx !== -1) {
      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[colName]) continue;
        const rawName = String(row[colName]).trim();
        if (!rawName || rawName.toUpperCase() === 'NAMA' || rawName.includes('---')) continue;
        const key = normalizeName(rawName);
        if (!key) continue;

        let phone = colPhone !== -1 && row[colPhone] ? String(row[colPhone]).replace(/[^0-9+]/g, '').trim() : null;
        if (phone && phone.startsWith('0')) phone = '+62' + phone.slice(1);

        const extra: any = {};
        if (phone && phone.length >= 8) extra.no_hp = phone;
        if (colAddress !== -1 && row[colAddress]) extra.alamat = String(row[colAddress]).trim();
        if (colTtl !== -1 && row[colTtl]) extra.tempat_tgl_lahir = String(row[colTtl]).trim();
        if (colIbu !== -1 && row[colIbu]) extra.nama_ibu = String(row[colIbu]).trim();
        if (colPendidikan !== -1 && row[colPendidikan]) extra.pendidikan_terakhir = String(row[colPendidikan]).trim();
        if (colStatus !== -1 && row[colStatus]) extra.status_kepegawaian = String(row[colStatus]).trim();

        if (Object.keys(extra).length > 0) {
          profileMap.set(key, { ...profileMap.get(key), ...extra });
        }
      }
    }
  }

  return profileMap;
}

// Parse CSV Google Sheets
function parseGoogleSheetsCSV(csvText: string): Array<{ no: number; nama: string; jk: string; homebase: string }> {
  const lines = csvText.split(/\r?\n/);
  const items: Array<{ no: number; nama: string; jk: string; homebase: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Sederhana tapi aman untuk CSV dengan kutip dua
    const matches: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        matches.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    matches.push(cur.trim());

    if (matches.length < 4) continue;
    const colNo = matches[0].replace(/["']/g, '').trim();
    const colNama = matches[1].replace(/["']/g, '').trim();
    const colJk = matches[2].replace(/["']/g, '').trim().toUpperCase();
    const colHomebase = matches[3].replace(/["']/g, '').trim();

    if (!colNama || colNama === 'NAMA' || colNama.includes('DATA GURU')) continue;
    const noNum = parseInt(colNo, 10) || items.length + 1;
    const jkNorm = colJk === 'P' || colJk === 'PR' || colJk.includes('PEREMPUAN') ? 'P' : 'L';

    items.push({
      no: noNum,
      nama: colNama,
      jk: jkNorm,
      homebase: colHomebase || 'YPMA'
    });
  }

  return items;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && payload.role !== 'staff' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya admin & pengasuh yang dapat mensinkronkan data.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'auto'; // 'online', 'offline', 'auto'

    let teachers: Array<{ no: number; nama: string; jk: string; homebase: string }> = [];
    let sourceUsed = '';

    // Cari file XLSX lokal untuk enrichment profil
    const xlsxPath = path.join(process.cwd(), 'YAYASAN Lengkap.xlsx');
    let extraMap = new Map<string, any>();
    let localWb: xlsx.WorkBook | null = null;

    if (fs.existsSync(xlsxPath)) {
      try {
        localWb = xlsx.readFile(xlsxPath);
        extraMap = extractExtraProfiles(localWb);
      } catch (e: any) {
        console.warn('Gagal membaca extra profil dari XLSX:', e.message);
      }
    }

    // 1. Ambil Data
    if (mode === 'offline') {
      if (!localWb) throw new Error('File YAYASAN Lengkap.xlsx tidak ditemukan di server.');
      const sheet = localWb.Sheets['2026'];
      if (!sheet) throw new Error('Sheet 2026 tidak ditemukan dalam file XLSX.');
      const rawRows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      for (const r of rawRows) {
        if (!r || !r[1] || typeof r[1] !== 'string') continue;
        const name = r[1].trim();
        if (name === 'NAMA' || name.includes('DATA GURU')) continue;
        const jk = String(r[2] || '').trim().toUpperCase();
        teachers.push({
          no: typeof r[0] === 'number' ? r[0] : teachers.length + 1,
          nama: name,
          jk: jk === 'P' ? 'P' : 'L',
          homebase: String(r[3] || 'YPMA').trim()
        });
      }
      sourceUsed = 'Offline (YAYASAN Lengkap.xlsx)';
    } else {
      // Coba online Google Sheets
      const googleSheetsUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRK3Yl6rUKLQx3SuKRuqfVP3iPIxNNtz_BDHhtY_uN98VjS9gxr8RruDLjozofXu89rAbhy0Dc19thD/pub?output=csv';
      try {
        const res = await fetch(googleSheetsUrl, { next: { revalidate: 0 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csvText = await res.text();
        teachers = parseGoogleSheetsCSV(csvText);
        sourceUsed = 'Online (Google Sheets CSV)';
      } catch (netErr: any) {
        if (mode === 'online') {
          throw new Error('Gagal mengambil data dari Google Sheets: ' + netErr.message);
        }
        // Fallback ke offline
        if (localWb) {
          const sheet = localWb.Sheets['2026'];
          if (sheet) {
            const rawRows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
            for (const r of rawRows) {
              if (!r || !r[1] || typeof r[1] !== 'string') continue;
              const name = r[1].trim();
              if (name === 'NAMA' || name.includes('DATA GURU')) continue;
              const jk = String(r[2] || '').trim().toUpperCase();
              teachers.push({
                no: typeof r[0] === 'number' ? r[0] : teachers.length + 1,
                nama: name,
                jk: jk === 'P' ? 'P' : 'L',
                homebase: String(r[3] || 'YPMA').trim()
              });
            }
            sourceUsed = 'Offline Fallback (YAYASAN Lengkap.xlsx)';
          }
        }
      }
    }

    if (teachers.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada data guru yang berhasil dimuat.' }, { status: 400 });
    }

    // 2. Pastikan tabel siap
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS dewan_guru (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nip VARCHAR(50) DEFAULT NULL,
        nama VARCHAR(255) NOT NULL,
        jenis_kelamin ENUM('L', 'P') NOT NULL DEFAULT 'L',
        homebase VARCHAR(100) NOT NULL DEFAULT 'YPMA',
        no_hp VARCHAR(50) DEFAULT NULL,
        alamat TEXT DEFAULT NULL,
        tempat_tgl_lahir VARCHAR(150) DEFAULT NULL,
        nama_ibu VARCHAR(150) DEFAULT NULL,
        suami_istri VARCHAR(150) DEFAULT NULL,
        pendidikan_terakhir VARCHAR(150) DEFAULT NULL,
        status_kepegawaian VARCHAR(50) DEFAULT NULL,
        qr_token VARCHAR(100) NOT NULL UNIQUE,
        foto VARCHAR(255) DEFAULT NULL,
        aktif TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_homebase (homebase),
        INDEX idx_qr_token (qr_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Ambil guru yang sudah ada agar qr_token tidak berubah-ubah
    const [existingRows]: any = await pool.execute('SELECT id, nama, homebase, qr_token, no_hp FROM dewan_guru');
    const existingMap = new Map<string, any>();
    for (const ex of existingRows) {
      const key = `${normalizeName(ex.nama)}__${normalizeName(ex.homebase)}`;
      existingMap.set(key, ex);
    }

    let inserted = 0;
    let updated = 0;

    for (const t of teachers) {
      const key = `${normalizeName(t.nama)}__${normalizeName(t.homebase)}`;
      const existing = existingMap.get(key);
      const extra = extraMap.get(normalizeName(t.nama)) || {};

      if (existing) {
        // Update data jika ada perubahan atau nomor HP baru
        const phone = existing.no_hp || extra.no_hp || null;
        await pool.execute(`
          UPDATE dewan_guru
          SET jenis_kelamin = ?,
              no_hp = COALESCE(no_hp, ?),
              alamat = COALESCE(alamat, ?),
              tempat_tgl_lahir = COALESCE(tempat_tgl_lahir, ?),
              nama_ibu = COALESCE(nama_ibu, ?),
              pendidikan_terakhir = COALESCE(pendidikan_terakhir, ?),
              status_kepegawaian = COALESCE(status_kepegawaian, ?),
              aktif = 1
          WHERE id = ?
        `, [
          t.jk,
          phone,
          extra.alamat || null,
          extra.tempat_tgl_lahir || null,
          extra.nama_ibu || null,
          extra.pendidikan_terakhir || null,
          extra.status_kepegawaian || null,
          existing.id
        ]);
        updated++;
      } else {
        // Buat QR token unik yang aman
        const qrToken = 'dg_' + crypto.randomBytes(12).toString('hex');
        await pool.execute(`
          INSERT INTO dewan_guru (
            nama, jenis_kelamin, homebase, no_hp, alamat, tempat_tgl_lahir,
            nama_ibu, pendidikan_terakhir, status_kepegawaian, qr_token, aktif
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          t.nama,
          t.jk,
          t.homebase,
          extra.no_hp || null,
          extra.alamat || null,
          extra.tempat_tgl_lahir || null,
          extra.nama_ibu || null,
          extra.pendidikan_terakhir || null,
          extra.status_kepegawaian || null,
          qrToken
        ]);
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      source: sourceUsed,
      total_loaded: teachers.length,
      inserted,
      updated,
      message: `Berhasil memproses ${teachers.length} dewan guru (${inserted} baru ditambahkan, ${updated} diperbarui) dari ${sourceUsed}.`
    });
  } catch (error: any) {
    console.error('Dewan guru sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Support GET untuk kemudahan pengecekan
  return POST(request);
}
