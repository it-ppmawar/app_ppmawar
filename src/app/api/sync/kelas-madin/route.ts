import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

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

function parseMadinSheet(sheet: XLSX.WorkSheet, gender: 'Laki-laki' | 'Perempuan') {
  if (!sheet) return [];
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) || [];
  const result: Array<{ gender: string; classInSheet: string; no: number; induk: any; nama: string; normNama: string }> = [];
  let currentClass = '';

  for (let r = 0; r < rawData.length; r++) {
    const row = rawData[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const cleanRow = Array.from(row);

    // Detect class header
    for (let c = 0; c < cleanRow.length; c++) {
      const cellVal = safeString(cleanRow[c]);
      const upperVal = cellVal.toUpperCase();

      if (upperVal.includes('KELAS')) {
        const match = cellVal.match(/kelas\s*:\s*(.+)/i) || cellVal.match(/kelas\s+(.+)/i);
        if (match && match[1] && match[1].trim().length > 1) {
          currentClass = match[1].trim();
          break;
        }
        for (let k = c + 1; k < cleanRow.length; k++) {
          const nextVal = safeString(cleanRow[k]);
          if (nextVal && nextVal !== ':' && nextVal.length > 1) {
            currentClass = nextVal;
            break;
          }
        }
      }
    }

    const numCol = cleanRow[0];
    const nameInCol1 = safeString(cleanRow[1]);
    const nameInCol2 = safeString(cleanRow[2]);

    let candidateNama = '';
    let noVal = 0;
    let indukVal = null;

    if (typeof numCol === 'number' || (typeof numCol === 'string' && /^\d+$/.test(numCol.trim()))) {
      noVal = Number(numCol);
      if (nameInCol2.length > 2 && !nameInCol2.toUpperCase().includes('NAMA SANTRI') && !nameInCol2.toUpperCase().includes('TAHUN TADRIS')) {
        candidateNama = nameInCol2;
        indukVal = cleanRow[1];
      } else if (nameInCol1.length > 2 && !nameInCol1.toUpperCase().includes('NAMA SANTRI') && !nameInCol1.toUpperCase().includes('TAHUN TADRIS') && !/^(MTS|SMP|MA|SMK)$/i.test(nameInCol1)) {
        candidateNama = nameInCol1;
      }
    }

    if (candidateNama && candidateNama.length > 2) {
      result.push({
        gender,
        classInSheet: currentClass,
        no: noVal,
        induk: indukVal,
        nama: candidateNama,
        normNama: normalizeName(candidateNama)
      });
    }
  }
  return result;
}

// Safely load workbook from path
function loadWorkbookSafely(filePath: string): XLSX.WorkBook | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    return XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    console.error(`Error reading file at ${filePath}:`, err);
    return null;
  }
}

// Find source Excel files safely
function resolveExcelSources(): Array<{ file: string; sheet: string; gender: 'Laki-laki' | 'Perempuan' }> {
  const cwd = process.cwd();
  const dataMadinDir = path.join(cwd, 'data_madin');
  const defaultExcel = path.join(cwd, 'JADWAL MADIN 2026-2027.xlsx');

  // Check data_madin folder first
  if (fs.existsSync(dataMadinDir)) {
    return [
      { file: path.join(dataMadinDir, 'SANTRI BARU FIKS 2025.xlsx'), sheet: 'PEGANGAN GURU 1', gender: 'Perempuan' },
      { file: path.join(dataMadinDir, 'SANTRI LAMA PUTRI 2 fiks.xlsx'), sheet: 'PEGANGAN GURU 1', gender: 'Perempuan' },
      { file: path.join(dataMadinDir, 'JADWAL MADIN 2026-2027.xlsx'), sheet: 'PUTRA', gender: 'Laki-laki' }
    ];
  }

  // Check default file in root
  if (fs.existsSync(defaultExcel)) {
    const wb = loadWorkbookSafely(defaultExcel);
    if (wb) {
      const sheets = wb.SheetNames.map(s => s.trim().toUpperCase());
      const sources: Array<{ file: string; sheet: string; gender: 'Laki-laki' | 'Perempuan' }> = [];
      if (sheets.includes('PUTRA')) sources.push({ file: defaultExcel, sheet: 'PUTRA', gender: 'Laki-laki' });
      if (sheets.includes('PUTRI')) sources.push({ file: defaultExcel, sheet: 'PUTRI', gender: 'Perempuan' });
      if (sources.length > 0) return sources;

      // Fallback: use first sheet if sheet names differ
      if (wb.SheetNames.length > 0) {
        return [{ file: defaultExcel, sheet: wb.SheetNames[0], gender: 'Laki-laki' }];
      }
    }
  }

  return [];
}

// GET: Summary analysis of sync status
export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sources = resolveExcelSources();
    if (sources.length === 0) {
      return NextResponse.json({ error: 'File Excel sinkronisasi Madin (JADWAL MADIN 2026-2027.xlsx) tidak ditemukan di server.' }, { status: 404 });
    }

    let allExcel: any[] = [];
    for (const src of sources) {
      const wb = loadWorkbookSafely(src.file);
      if (wb) {
        const targetSheetName = wb.SheetNames.find(s => s.trim().toUpperCase() === src.sheet.toUpperCase()) || wb.SheetNames[0];
        const sh = wb.Sheets[targetSheetName];
        if (sh) {
          allExcel = allExcel.concat(parseMadinSheet(sh, src.gender));
        }
      }
    }

    const [dbClasses] = await pool.execute<RowDataPacket[]>('SELECT * FROM kelas_madin');
    const classNameToIdMap = new Map<string, number>();
    const classMap = new Map<number, string>();
    dbClasses.forEach(c => {
      const nama = safeString(c.nama_kelas);
      const norm = nama.toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      classNameToIdMap.set(norm, c.kelas_id);
      classMap.set(c.kelas_id, nama);
    });

    const [dbMurid] = await pool.execute<RowDataPacket[]>('SELECT murid_id, nis, nama, jenis_kelamin, kelas_madin_id FROM murid');
    const dbMuridMap = new Map<string, RowDataPacket[]>();
    const dbMuridList: any[] = dbMurid.map(m => ({
      murid_id: m.murid_id,
      nis: m.nis,
      nama: safeString(m.nama),
      jenis_kelamin: safeString(m.jenis_kelamin),
      kelas_madin_id: m.kelas_madin_id,
      normNama: normalizeName(m.nama)
    }));
    dbMurid.forEach(m => {
      const key = normalizeName(m.nama);
      if (!dbMuridMap.has(key)) dbMuridMap.set(key, []);
      dbMuridMap.get(key)!.push(m);
    });

    let matchedCount = 0;
    let fuzzyMatchedCount = 0;
    let alreadySynced = 0;
    let needsUpdate = 0;
    const notInDb: any[] = [];
    const updateList: any[] = [];

    allExcel.forEach(ex => {
      const matches = dbMuridMap.get(ex.normNama);
      const normExClass = safeString(ex.classInSheet).toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      const targetClassId = classNameToIdMap.get(normExClass) || null;

      let dbSantri = matches ? matches[0] : null;

      if (!dbSantri) {
        let bestMatch = null;
        let maxScore = 0;
        for (const db of dbMuridList) {
          if (db.jenis_kelamin !== ex.gender) continue;
          const score = similarityScore(ex.nama, db.nama);
          if (score > maxScore) {
            maxScore = score;
            bestMatch = db;
          }
        }
        if (bestMatch && maxScore >= 0.8) {
          dbSantri = bestMatch;
          fuzzyMatchedCount++;
        }
      }

      if (!dbSantri) {
        notInDb.push(ex);
      } else {
        matchedCount++;
        if (dbSantri.kelas_madin_id === targetClassId) {
          alreadySynced++;
        } else {
          needsUpdate++;
          updateList.push({
            muridId: dbSantri.murid_id,
            nama: dbSantri.nama,
            kelasAwal: classMap.get(dbSantri.kelas_madin_id) || 'Belum Ada',
            kelasBaru: ex.classInSheet,
            targetClassId
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalExcel: allExcel.length,
        totalDbMurid: dbMurid.length,
        matchedCount,
        fuzzyMatchedCount,
        alreadySynced,
        needsUpdate,
        notInDbCount: notInDb.length
      },
      updateListSummary: updateList.slice(0, 50),
      notInDbSummary: notInDb.slice(0, 50)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}

// POST: Perform sync or register missing santri
export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const registerMissing = body.registerMissing === true;
    const targetGender = body.targetGender;

    let sources = resolveExcelSources();
    if (sources.length === 0) {
      return NextResponse.json({ error: 'File Excel sinkronisasi Madin (JADWAL MADIN 2026-2027.xlsx) tidak ditemukan di server.' }, { status: 404 });
    }

    if (targetGender) {
      sources = sources.filter(s => s.gender === targetGender);
    }

    let allExcel: any[] = [];
    for (const src of sources) {
      const wb = loadWorkbookSafely(src.file);
      if (wb) {
        const targetSheetName = wb.SheetNames.find(s => s.trim().toUpperCase() === src.sheet.toUpperCase()) || wb.SheetNames[0];
        const sh = wb.Sheets[targetSheetName];
        if (sh) {
          allExcel = allExcel.concat(parseMadinSheet(sh, src.gender));
        }
      }
    }

    const [dbClasses] = await pool.execute<RowDataPacket[]>('SELECT * FROM kelas_madin');
    const classNameToIdMap = new Map<string, number>();
    dbClasses.forEach(c => {
      const nama = safeString(c.nama_kelas);
      const norm = nama.toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      classNameToIdMap.set(norm, c.kelas_id);
    });

    const [dbMurid] = await pool.execute<RowDataPacket[]>('SELECT murid_id, nis, nama, jenis_kelamin, kelas_madin_id FROM murid');
    const dbMuridMap = new Map<string, RowDataPacket[]>();
    const dbMuridList: any[] = dbMurid.map(m => ({
      murid_id: m.murid_id,
      nis: m.nis,
      nama: safeString(m.nama),
      jenis_kelamin: safeString(m.jenis_kelamin),
      kelas_madin_id: m.kelas_madin_id,
      normNama: normalizeName(m.nama)
    }));
    dbMurid.forEach(m => {
      const key = normalizeName(m.nama);
      if (!dbMuridMap.has(key)) dbMuridMap.set(key, []);
      dbMuridMap.get(key)!.push(m);
    });

    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;
    let fuzzyUpdatedCount = 0;

    for (const ex of allExcel) {
      const matches = dbMuridMap.get(ex.normNama);
      const normExClass = safeString(ex.classInSheet).toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      const targetClassId = classNameToIdMap.get(normExClass) || null;

      let dbSantri = matches ? matches[0] : null;

      if (!dbSantri) {
        let bestMatch = null;
        let maxScore = 0;
        for (const db of dbMuridList) {
          if (db.jenis_kelamin !== ex.gender) continue;
          const score = similarityScore(ex.nama, db.nama);
          if (score > maxScore) {
            maxScore = score;
            bestMatch = db;
          }
        }
        if (bestMatch && maxScore >= 0.8) {
          dbSantri = bestMatch;
          fuzzyUpdatedCount++;
        }
      }

      if (dbSantri) {
        if (targetClassId && dbSantri.kelas_madin_id !== targetClassId) {
          await pool.execute('UPDATE murid SET kelas_madin_id = ? WHERE murid_id = ?', [targetClassId, dbSantri.murid_id]);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else if (registerMissing) {
        const generatedNis = '2026' + String(Math.floor(100000 + Math.random() * 900000));
        await pool.execute(
          'INSERT INTO murid (nis, nama, jenis_kelamin, kelas_madin_id) VALUES (?, ?, ?, ?)',
          [generatedNis, ex.nama, ex.gender, targetClassId]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi berhasil: ${updatedCount} kelas santri diperbarui (${fuzzyUpdatedCount} via kemiripan ejaan >80%)${insertedCount > 0 ? `, ${insertedCount} santri baru didaftarkan` : ''}.`,
      details: { updatedCount, fuzzyUpdatedCount, insertedCount, skippedCount, totalExcel: allExcel.length }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
