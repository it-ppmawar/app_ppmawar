import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload) return null;
  return payload;
}

// ─── Fuzzy Matching ──────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarityScore(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return 0;
  const dist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function findColIndex(headers: string[], aliases: string[]): number {
  const normHeaders = headers.map(h => String(h || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  for (const alias of aliases) {
    const normAlias = alias.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const idx = normHeaders.indexOf(normAlias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const normAlias = alias.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const idx = normHeaders.findIndex(h => h.length > 2 && (h.includes(normAlias) || normAlias.includes(h)));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ─── Auto Detect Mode ────────────────────────────────────────────────────────

type SyncMode = 'madin' | 'quran' | 'kamar' | 'unknown';

function detectSyncMode(workbook: XLSX.WorkBook): SyncMode {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const row = rows[r];
      if (!row) continue;
      const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');

      // Detect by sheet header cells
      if (
        rowStr.includes('KELAS MADIN') ||
        rowStr.includes('MADIN') ||
        rowStr.includes('ULA') ||
        rowStr.includes('WUSTHO') ||
        rowStr.includes('MAK') ||
        rowStr.includes('PEGANGAN GURU') ||
        rowStr.includes('PEGANGAN SANTRI')
      ) return 'madin';

      if (
        rowStr.includes('KELAS QURAN') ||
        rowStr.includes('KELAS AL') ||
        rowStr.includes('QURAN') ||
        rowStr.includes('TAHFIDZ') ||
        rowStr.includes('TQ PUTRI') ||
        rowStr.includes('TQ PUTRA')
      ) return 'quran';

      if (
        rowStr.includes('KAMAR') ||
        rowStr.includes('ASRAMA') ||
        rowStr.includes('BLOK') ||
        rowStr.includes('PEMBINA KAMAR')
      ) return 'kamar';
    }

    // Also check sheet name itself
    const upper = sheetName.toUpperCase();
    if (upper.includes('MADIN') || upper.includes('ULA') || upper.includes('WUSTHO') || upper.includes('MAK') || upper.includes('PUTRA') || upper.includes('PUTRI')) return 'madin';
    if (upper.includes('QURAN') || upper.includes('TAHFIDZ') || upper.includes('TQ')) return 'quran';
    if (upper.includes('KAMAR') || upper.includes('ASRAMA')) return 'kamar';
  }

  return 'unknown';
}

// ─── Extract workbooks from file (Excel or ZIP) ───────────────────────────────

async function extractWorkbooks(buffer: ArrayBuffer, filename: string): Promise<XLSX.WorkBook[]> {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'zip') {
    // Use XLSX built-in zip parsing: parse_zip is internal, so we use CFB
    // We'll try to extract all xlsx files from the zip via XLSX.zip_deflate / read with type buffer
    try {
      // XLSX can read ZIP of xlsx files using the CFB container
      // Attempt to read as a zip container
      const uint8 = new Uint8Array(buffer);
      // Check for ZIP magic bytes: PK 03 04
      if (uint8[0] === 0x50 && uint8[1] === 0x4B) {
        // It's a ZIP. Use XLSX to read all entries
        const wb = XLSX.read(uint8, { type: 'array' });
        return [wb];
      }
    } catch {}

    // Fallback: try to read as plain xlsx
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    return [wb];
  }

  // Plain xlsx/xls
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  return [wb];
}

// ─── Parse Madin (format: PEGANGAN GURU / JADWAL MADIN) ───────────────────────

interface ParsedSantri {
  nama: string;
  normNama: string;
  kelasOrKamar: string;
}

function parseMadinWorkbook(workbook: XLSX.WorkBook): ParsedSantri[] {
  const result: ParsedSantri[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let currentClass = '';

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      // Detect class header
      for (let c = 0; c < row.length; c++) {
        if (typeof row[c] === 'string' && row[c].trim().toLowerCase() === 'kelas') {
          for (let k = c + 1; k < row.length; k++) {
            if (row[k] && typeof row[k] === 'string' && row[k].trim() !== ':' && row[k].trim().length > 1) {
              currentClass = row[k].trim();
              break;
            }
          }
        }
      }

      // Detect santri row (No Urut | Induk/Kelas | Nama)
      const num = row[0];
      const nama = row[2];
      if (
        typeof num === 'number' &&
        typeof nama === 'string' &&
        nama.trim().length > 2 &&
        !nama.includes('Nama Santri') &&
        !nama.includes('TAHUN TADRIS')
      ) {
        result.push({
          nama: nama.trim(),
          normNama: normalizeName(nama.trim()),
          kelasOrKamar: currentClass
        });
      }
    }

    // Also try tabular format (nama | kelas) if above yields nothing
    if (result.length === 0) {
      const headers = rows[0]?.map((h: any) => String(h || '').toUpperCase().trim()) || [];
      const colNama = findColIndex(headers, ['NAMA LENGKAP', 'NAMA SANTRI', 'NAMA']);
      const colKelas = findColIndex(headers, ['KELAS MADIN', 'KELAS', 'KELAS/KAMAR']);

      if (colNama !== -1 && colKelas !== -1) {
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const nama = String(row[colNama] || '').trim();
          const kelas = String(row[colKelas] || '').trim();
          if (nama && kelas) {
            result.push({ nama, normNama: normalizeName(nama), kelasOrKamar: kelas });
          }
        }
      }
    }
  }

  return result;
}

function parseQuranWorkbook(workbook: XLSX.WorkBook): ParsedSantri[] {
  const result: ParsedSantri[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) continue;
    const headers = rows[0]?.map((h: any) => String(h || '').toUpperCase().trim()) || [];
    const colNama = findColIndex(headers, ['NAMA LENGKAP', 'NAMA SANTRI', 'NAMA']);
    const colKelas = findColIndex(headers, ['KELAS QURAN', 'KELAS AL QURAN', 'KELAS', 'TAHFIDZ']);

    if (colNama !== -1 && colKelas !== -1) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const nama = String(row[colNama] || '').trim();
        const kelas = String(row[colKelas] || '').trim();
        if (nama && kelas) {
          result.push({ nama, normNama: normalizeName(nama), kelasOrKamar: kelas });
        }
      }
    }
  }

  return result;
}

function parseKamarWorkbook(workbook: XLSX.WorkBook): ParsedSantri[] {
  const result: ParsedSantri[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) continue;
    const headers = rows[0]?.map((h: any) => String(h || '').toUpperCase().trim()) || [];
    const colNama = findColIndex(headers, ['NAMA LENGKAP', 'NAMA SANTRI', 'NAMA']);
    const colKamar = findColIndex(headers, ['KAMAR', 'NAMA KAMAR', 'ASRAMA', 'BLOK']);

    if (colNama !== -1 && colKamar !== -1) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const nama = String(row[colNama] || '').trim();
        const kamar = String(row[colKamar] || '').trim();
        if (nama && kamar) {
          result.push({ nama, normNama: normalizeName(nama), kelasOrKamar: kamar });
        }
      }
    }
  }

  return result;
}

// ─── POST: Smart Upload & Sync ────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff yang dapat mengimpor data' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const modeOverride = (formData.get('mode') as string | null) || '';

    if (!file) {
      return NextResponse.json({ error: 'File harus disertakan (Excel .xlsx atau .zip)' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls') && !filename.endsWith('.zip')) {
      return NextResponse.json({ error: 'Format file tidak didukung. Gunakan .xlsx atau .zip' }, { status: 400 });
    }

    // Read file IN MEMORY — zero disk write
    const buffer = await file.arrayBuffer();
    const workbooks = await extractWorkbooks(buffer, file.name);

    if (workbooks.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file Excel yang dapat dibaca dari file yang diunggah' }, { status: 400 });
    }

    // Detect mode
    let syncMode: SyncMode = modeOverride as SyncMode || 'unknown';
    if (!syncMode || syncMode === 'unknown') {
      for (const wb of workbooks) {
        const detected = detectSyncMode(wb);
        if (detected !== 'unknown') {
          syncMode = detected;
          break;
        }
      }
    }

    if (syncMode === 'unknown') {
      return NextResponse.json({
        error: 'Tipe data tidak dapat terdeteksi otomatis. Silakan pilih mode secara manual: madin, quran, atau kamar.',
        detectedMode: 'unknown',
        hint: 'Tambahkan parameter mode=madin / mode=quran / mode=kamar pada request.'
      }, { status: 422 });
    }

    // Parse santri data
    let parsedList: ParsedSantri[] = [];
    for (const wb of workbooks) {
      if (syncMode === 'madin') parsedList = parsedList.concat(parseMadinWorkbook(wb));
      else if (syncMode === 'quran') parsedList = parsedList.concat(parseQuranWorkbook(wb));
      else if (syncMode === 'kamar') parsedList = parsedList.concat(parseKamarWorkbook(wb));
    }

    if (parsedList.length === 0) {
      return NextResponse.json({
        error: 'Tidak ada data santri yang dapat diekstrak dari file ini.',
        detectedMode: syncMode,
        hint: 'Pastikan file memiliki kolom Nama dan Kelas/Kamar yang dapat dibaca.'
      }, { status: 422 });
    }

    // Load DB data
    const [dbMuridRaw] = await pool.execute<RowDataPacket[]>(
      'SELECT murid_id, nama, jenis_kelamin, kelas_madin_id, kelas_quran_id, kamar_id FROM murid'
    );
    const dbMuridList = dbMuridRaw.map(m => ({
      murid_id: m.murid_id,
      nama: m.nama,
      jenis_kelamin: m.jenis_kelamin,
      normNama: normalizeName(m.nama)
    }));

    // Load class/room maps
    let refMap = new Map<string, number>(); // normalized name -> id

    if (syncMode === 'madin') {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT kelas_id, nama_kelas FROM kelas_madin');
      rows.forEach(r => {
        const norm = r.nama_kelas.toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ').trim();
        refMap.set(norm, r.kelas_id);
        // Also map without parentheses and simplified
        const simple = norm.replace(/\s/g, '');
        refMap.set(simple, r.kelas_id);
      });
    } else if (syncMode === 'quran') {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, nama_kelas FROM kelas_quran');
      rows.forEach(r => {
        refMap.set(r.nama_kelas.toUpperCase().replace(/\s+/g, ' ').trim(), r.id);
      });
    } else if (syncMode === 'kamar') {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT kamar_id, nama_kamar FROM kamar');
      rows.forEach(r => {
        refMap.set(r.nama_kamar.toUpperCase().replace(/\s+/g, ' ').trim(), r.kamar_id);
      });
    }

    // Process sync
    let updatedCount = 0;
    let exactMatchCount = 0;
    let fuzzyMatchCount = 0;
    const notFoundList: { nama: string; kelasKamar: string }[] = [];
    const errors: string[] = [];

    for (const item of parsedList) {
      // Find santri in DB
      let dbSantri = dbMuridList.find(m => m.normNama === item.normNama) || null;
      let isFuzzy = false;

      if (!dbSantri) {
        // Fuzzy search
        let best: typeof dbMuridList[0] | null = null;
        let bestScore = 0;
        for (const m of dbMuridList) {
          const score = similarityScore(item.nama, m.nama);
          if (score > bestScore) { bestScore = score; best = m; }
        }
        if (best && bestScore >= 0.8) {
          dbSantri = best;
          isFuzzy = true;
        }
      }

      if (!dbSantri) {
        notFoundList.push({ nama: item.nama, kelasKamar: item.kelasOrKamar });
        continue;
      }

      // Resolve ref ID (kelas or kamar)
      const normKelasKamar = item.kelasOrKamar.toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ').trim();
      let refId = refMap.get(normKelasKamar) || null;

      if (!refId) {
        // Try partial match
        for (const [key, val] of refMap.entries()) {
          if (key.includes(normKelasKamar) || normKelasKamar.includes(key)) {
            refId = val;
            break;
          }
        }
      }

      if (!refId) {
        errors.push(`Kelas/Kamar "${item.kelasOrKamar}" tidak ditemukan di database untuk santri ${item.nama}`);
        continue;
      }

      // Update DB
      try {
        if (syncMode === 'madin') {
          await pool.execute('UPDATE murid SET kelas_madin_id = ? WHERE murid_id = ?', [refId, dbSantri.murid_id]);
        } else if (syncMode === 'quran') {
          await pool.execute('UPDATE murid SET kelas_quran_id = ? WHERE murid_id = ?', [refId, dbSantri.murid_id]);
        } else if (syncMode === 'kamar') {
          await pool.execute('UPDATE murid SET kamar_id = ? WHERE murid_id = ?', [refId, dbSantri.murid_id]);
        }
        updatedCount++;
        if (isFuzzy) fuzzyMatchCount++;
        else exactMatchCount++;
      } catch (err: any) {
        errors.push(`Gagal update ${item.nama}: ${err.message}`);
      }
    }

    // File is already GC'd (in-memory, never written to disk)

    return NextResponse.json({
      success: true,
      detectedMode: syncMode,
      message: `Impor Cerdas selesai! ${updatedCount} santri diperbarui (${exactMatchCount} exact, ${fuzzyMatchCount} fuzzy >80%). ${notFoundList.length} tidak ditemukan.`,
      details: {
        syncMode,
        totalParsed: parsedList.length,
        updatedCount,
        exactMatchCount,
        fuzzyMatchCount,
        notFoundCount: notFoundList.length,
        errorsCount: errors.length
      },
      notFound: notFoundList.slice(0, 100),
      errors: errors.slice(0, 20)
    });

  } catch (error: any) {
    console.error('Error POST /api/sync/upload-file:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
