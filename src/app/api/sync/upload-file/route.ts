import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

async function getAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    const payload = verifyToken(token) as any;
    if (!payload) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Defensive Helpers ───────────────────────────────────────────────────────

function safeString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function normalizeName(name: any): string {
  const str = safeString(name);
  if (!str) return '';
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '');
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

function similarityScore(a: any, b: any): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return 0;
  const dist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function findColIndex(headers: any[], aliases: string[]): number {
  if (!Array.isArray(headers)) return -1;
  const cleanHeaders = Array.from(headers).map(h => safeString(h));
  const normHeaders = cleanHeaders.map(h => normalizeName(h));

  for (const alias of aliases) {
    const normAlias = normalizeName(alias);
    if (!normAlias) continue;
    const idx = normHeaders.indexOf(normAlias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const normAlias = normalizeName(alias);
    if (!normAlias) continue;
    const idx = normHeaders.findIndex(h => {
      const str = safeString(h);
      return str.length > 2 && (str.includes(normAlias) || normAlias.includes(str));
    });
    if (idx !== -1) return idx;
  }
  return -1;
}

// ─── Auto Detect Mode ────────────────────────────────────────────────────────

type SyncMode = 'madin' | 'quran' | 'kamar' | 'unknown';

function detectSyncMode(workbook: XLSX.WorkBook): SyncMode {
  if (!workbook || !Array.isArray(workbook.SheetNames)) return 'unknown';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) || [];

    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const rowStr = Array.from(row).map(c => safeString(c).toUpperCase()).join(' ');

      if (
        rowStr.includes('KELAS MADIN') ||
        rowStr.includes('MADIN') ||
        rowStr.includes('ULA') ||
        rowStr.includes('WUSTHO') ||
        rowStr.includes('MAK') ||
        rowStr.includes('PEGANGAN GURU') ||
        rowStr.includes('PEGANGAN SANTRI') ||
        rowStr.includes('DAFTAR HADIR DAN ABSENSI SANTRI')
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

    const upper = safeString(sheetName).toUpperCase();
    if (upper.includes('MADIN') || upper.includes('ULA') || upper.includes('WUSTHO') || upper.includes('MAK') || upper.includes('PUTRA') || upper.includes('PUTRI')) return 'madin';
    if (upper.includes('QURAN') || upper.includes('TAHFIDZ') || upper.includes('TQ')) return 'quran';
    if (upper.includes('KAMAR') || upper.includes('ASRAMA')) return 'kamar';
  }

  return 'unknown';
}

// ─── Extract Workbooks ────────────────────────────────────────────────────────

async function extractWorkbooks(buffer: ArrayBuffer, filename: string): Promise<XLSX.WorkBook[]> {
  try {
    const uint8 = new Uint8Array(buffer);
    const wb = XLSX.read(uint8, { type: 'array' });
    return [wb];
  } catch (e) {
    console.error('Error reading excel file:', filename, e);
    return [];
  }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

interface ParsedSantri {
  nama: string;
  normNama: string;
  kelasOrKamar: string;
  sourceFile: string;
}

function parseMadinWorkbook(workbook: XLSX.WorkBook, filename: string): ParsedSantri[] {
  const result: ParsedSantri[] = [];
  if (!workbook || !Array.isArray(workbook.SheetNames)) return result;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) || [];
    if (!Array.isArray(rows)) continue;

    let currentClass = '';

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const cleanRow = Array.from(row);

      // Detect class header in row (e.g. "Kelas : 1 Ula A Putra", "Kelas 2 Wustho", etc.)
      for (let c = 0; c < cleanRow.length; c++) {
        const cellVal = safeString(cleanRow[c]);
        const upperVal = cellVal.toUpperCase();

        if (upperVal.includes('KELAS')) {
          // Check if class name is in the same cell e.g. "Kelas : 1 Ula A Putra"
          const match = cellVal.match(/kelas\s*:\s*(.+)/i) || cellVal.match(/kelas\s+(.+)/i);
          if (match && match[1] && match[1].trim().length > 1) {
            currentClass = match[1].trim();
            break;
          }
          // Or in subsequent cells
          for (let k = c + 1; k < cleanRow.length; k++) {
            const nextVal = safeString(cleanRow[k]);
            if (nextVal && nextVal !== ':' && nextVal.length > 1) {
              currentClass = nextVal;
              break;
            }
          }
        }
      }

      // Check for santri row (Number in col 0, Name in col 1 or 2)
      const numCol = cleanRow[0];
      const nameInCol1 = safeString(cleanRow[1]);
      const nameInCol2 = safeString(cleanRow[2]);

      let candidateNama = '';
      if (typeof numCol === 'number' || (typeof numCol === 'string' && /^\d+$/.test(numCol.trim()))) {
        if (nameInCol2.length > 2 && !nameInCol2.toUpperCase().includes('NAMA SANTRI') && !nameInCol2.toUpperCase().includes('TAHUN TADRIS')) {
          candidateNama = nameInCol2;
        } else if (nameInCol1.length > 2 && !nameInCol1.toUpperCase().includes('NAMA SANTRI') && !nameInCol1.toUpperCase().includes('TAHUN TADRIS') && !/^(MTS|SMP|MA|SMK)$/i.test(nameInCol1)) {
          candidateNama = nameInCol1;
        }
      }

      if (candidateNama && candidateNama.length > 2) {
        result.push({
          nama: candidateNama,
          normNama: normalizeName(candidateNama),
          kelasOrKamar: currentClass,
          sourceFile: filename
        });
      }
    }

    // Tabular format fallback
    if (result.length === 0 && rows.length > 1) {
      const firstRow = Array.isArray(rows[0]) ? Array.from(rows[0]) : [];
      const headers = firstRow.map(h => safeString(h).toUpperCase());
      const colNama = findColIndex(headers, ['NAMA LENGKAP', 'NAMA SANTRI', 'NAMA']);
      const colKelas = findColIndex(headers, ['KELAS MADIN', 'KELAS', 'KELAS/KAMAR']);

      if (colNama !== -1 && colKelas !== -1) {
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          const cleanR = Array.from(row);
          const nama = safeString(cleanR[colNama]);
          const kelas = safeString(cleanR[colKelas]);
          if (nama && kelas) {
            result.push({ nama, normNama: normalizeName(nama), kelasOrKamar: kelas, sourceFile: filename });
          }
        }
      }
    }
  }

  return result;
}

function parseQuranWorkbook(workbook: XLSX.WorkBook, filename: string): ParsedSantri[] {
  const result: ParsedSantri[] = [];
  if (!workbook || !Array.isArray(workbook.SheetNames)) return result;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) || [];

    if (rows.length < 2) continue;
    const firstRow = Array.isArray(rows[0]) ? Array.from(rows[0]) : [];
    const headers = firstRow.map(h => safeString(h).toUpperCase());
    const colNama = findColIndex(headers, ['NAMA LENGKAP', 'NAMA SANTRI', 'NAMA']);
    const colKelas = findColIndex(headers, ['KELAS QURAN', 'KELAS AL QURAN', 'KELAS', 'TAHFIDZ']);

    if (colNama !== -1 && colKelas !== -1) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const cleanR = Array.from(row);
        const nama = safeString(cleanR[colNama]);
        const kelas = safeString(cleanR[colKelas]);
        if (nama && kelas) {
          result.push({ nama, normNama: normalizeName(nama), kelasOrKamar: kelas, sourceFile: filename });
        }
      }
    }
  }

  return result;
}

function parseKamarWorkbook(workbook: XLSX.WorkBook, filename: string): ParsedSantri[] {
  const result: ParsedSantri[] = [];
  if (!workbook || !Array.isArray(workbook.SheetNames)) return result;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) || [];

    if (rows.length < 2) continue;
    const firstRow = Array.isArray(rows[0]) ? Array.from(rows[0]) : [];
    const headers = firstRow.map(h => safeString(h).toUpperCase());
    const colNama = findColIndex(headers, ['NAMA LENGKAP', 'NAMA SANTRI', 'NAMA']);
    const colKamar = findColIndex(headers, ['KAMAR', 'NAMA KAMAR', 'ASRAMA', 'BLOK']);

    if (colNama !== -1 && colKamar !== -1) {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const cleanR = Array.from(row);
        const nama = safeString(cleanR[colNama]);
        const kamar = safeString(cleanR[colKamar]);
        if (nama && kamar) {
          result.push({ nama, normNama: normalizeName(nama), kelasOrKamar: kamar, sourceFile: filename });
        }
      }
    }
  }

  return result;
}

// ─── POST: Smart Upload & Sync (Supports Multiple Files & Zip) ────────────────

export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff yang dapat mengimpor data' }, { status: 403 });
    }

    const formData = await request.formData();
    
    // Collect all uploaded files from 'files' or 'file' form fields
    const rawFiles = [
      ...formData.getAll('files'),
      ...formData.getAll('file')
    ].filter((f): f is File => f instanceof File && f.size > 0);

    const modeOverride = safeString(formData.get('mode'));

    if (rawFiles.length === 0) {
      return NextResponse.json({ error: 'Minimal satu file Excel (.xlsx) atau .zip harus diunggah.' }, { status: 400 });
    }

    // Process all files in-memory
    const allWorkbooks: Array<{ filename: string; wb: XLSX.WorkBook }> = [];

    for (const file of rawFiles) {
      const filename = safeString(file.name);
      const ext = filename.toLowerCase().split('.').pop();
      if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'zip') continue;

      const buffer = await file.arrayBuffer();
      const extracted = await extractWorkbooks(buffer, filename);
      extracted.forEach(wb => {
        allWorkbooks.push({ filename, wb });
      });
    }

    if (allWorkbooks.length === 0) {
      return NextResponse.json({ error: 'Format file tidak didukung atau file kosong. Gunakan .xlsx, .xls, atau .zip' }, { status: 400 });
    }

    // Auto-detect mode if not overridden
    let syncMode: SyncMode = (modeOverride as SyncMode) || 'unknown';
    if (!syncMode || syncMode === 'unknown') {
      for (const item of allWorkbooks) {
        const detected = detectSyncMode(item.wb);
        if (detected !== 'unknown') {
          syncMode = detected;
          break;
        }
      }
    }

    if (syncMode === 'unknown') {
      return NextResponse.json({
        error: 'Tipe data tidak dapat terdeteksi otomatis dari file-file tersebut. Silakan pilih mode secara manual: Madin, Quran, atau Kamar.',
        detectedMode: 'unknown'
      }, { status: 422 });
    }

    // Extract santri data across all files
    let parsedList: ParsedSantri[] = [];
    for (const item of allWorkbooks) {
      if (syncMode === 'madin') parsedList = parsedList.concat(parseMadinWorkbook(item.wb, item.filename));
      else if (syncMode === 'quran') parsedList = parsedList.concat(parseQuranWorkbook(item.wb, item.filename));
      else if (syncMode === 'kamar') parsedList = parsedList.concat(parseKamarWorkbook(item.wb, item.filename));
    }

    if (parsedList.length === 0) {
      return NextResponse.json({
        error: `Tidak ada data santri yang cocok untuk mode "${syncMode.toUpperCase()}" yang dapat diekstrak dari file yang diunggah.`,
        detectedMode: syncMode
      }, { status: 422 });
    }

    // Fetch Database Records
    const [dbMuridRaw] = await pool.execute<RowDataPacket[]>(
      'SELECT murid_id, nama, jenis_kelamin, kelas_madin_id, kelas_quran_id, kamar_id FROM murid'
    );
    const dbMuridList = dbMuridRaw.map(m => ({
      murid_id: m.murid_id,
      nama: safeString(m.nama),
      jenis_kelamin: safeString(m.jenis_kelamin),
      normNama: normalizeName(m.nama)
    }));

    // Build Reference Class/Room ID Map safely
    const refMap = new Map<string, number>();

    if (syncMode === 'madin') {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT kelas_id, nama_kelas FROM kelas_madin');
      rows.forEach(r => {
        const namaKelas = safeString(r.nama_kelas);
        if (namaKelas) {
          const norm = namaKelas.toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ').trim();
          refMap.set(norm, r.kelas_id);
          const simple = norm.replace(/\s/g, '');
          refMap.set(simple, r.kelas_id);
        }
      });
    } else if (syncMode === 'quran') {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, nama_kelas FROM kelas_quran');
      rows.forEach(r => {
        const namaKelas = safeString(r.nama_kelas);
        if (namaKelas) {
          refMap.set(namaKelas.toUpperCase().replace(/\s+/g, ' ').trim(), r.id);
        }
      });
    } else if (syncMode === 'kamar') {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT kamar_id, nama_kamar FROM kamar');
      rows.forEach(r => {
        const namaKamar = safeString(r.nama_kamar);
        if (namaKamar) {
          refMap.set(namaKamar.toUpperCase().replace(/\s+/g, ' ').trim(), r.kamar_id);
        }
      });
    }

    // Perform In-Memory Sync to Database
    let updatedCount = 0;
    let exactMatchCount = 0;
    let fuzzyMatchCount = 0;
    const notFoundList: { nama: string; kelasKamar: string; file: string }[] = [];
    const errors: string[] = [];

    for (const item of parsedList) {
      if (!item.nama) continue;

      let dbSantri = dbMuridList.find(m => m.normNama === item.normNama) || null;
      let isFuzzy = false;

      if (!dbSantri) {
        let best: typeof dbMuridList[0] | null = null;
        let bestScore = 0;
        for (const m of dbMuridList) {
          const score = similarityScore(item.nama, m.nama);
          if (score > bestScore) {
            bestScore = score;
            best = m;
          }
        }
        if (best && bestScore >= 0.8) {
          dbSantri = best;
          isFuzzy = true;
        }
      }

      if (!dbSantri) {
        notFoundList.push({ nama: item.nama, kelasKamar: item.kelasOrKamar || '-', file: item.sourceFile });
        continue;
      }

      const normKelasKamar = safeString(item.kelasOrKamar).toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ').trim();
      let refId = normKelasKamar ? refMap.get(normKelasKamar) || null : null;

      if (!refId && normKelasKamar) {
        for (const [key, val] of refMap.entries()) {
          if (key.includes(normKelasKamar) || normKelasKamar.includes(key)) {
            refId = val;
            break;
          }
        }
      }

      if (!refId) {
        if (item.kelasOrKamar) {
          errors.push(`Kelas/Kamar "${item.kelasOrKamar}" tidak terdaftar di database (santri: ${item.nama})`);
        }
        continue;
      }

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

    return NextResponse.json({
      success: true,
      detectedMode: syncMode,
      message: `Impor Cerdas selesai! ${updatedCount} data santri berhasil diperbarui (${exactMatchCount} exact, ${fuzzyMatchCount} fuzzy >80%). ${notFoundList.length} santri belum terdaftar di DB.`,
      details: {
        syncMode,
        totalFiles: rawFiles.length,
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
    return NextResponse.json({ error: 'Server error: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}
