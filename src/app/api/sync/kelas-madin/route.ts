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
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload) return null;
  return payload;
}

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
  const dist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function parseMadinSheet(sheet: XLSX.WorkSheet, gender: 'Laki-laki' | 'Perempuan') {
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const result: Array<{ gender: string; classInSheet: string; no: number; induk: any; nama: string; normNama: string }> = [];
  let currentClass = '';

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;

    const rowStr = row.join(' ');
    if (rowStr.includes('Kelas') && rowStr.includes(':')) {
      for (let c = 0; c < row.length; c++) {
        if (typeof row[c] === 'string' && row[c].includes(':') && row[c + 1]) {
          currentClass = String(row[c + 1]).trim();
          break;
        } else if (typeof row[c] === 'string' && row[c] === 'Kelas') {
          for (let k = c + 1; k < row.length; k++) {
            if (row[k] && typeof row[k] === 'string' && row[k].trim() !== ':' && row[k].trim().length > 1) {
              currentClass = row[k].trim();
              break;
            }
          }
        }
      }
    }

    if (typeof row[0] === 'number' && typeof row[2] === 'string' && row[2].trim().length > 1) {
      result.push({
        gender,
        classInSheet: currentClass,
        no: row[0],
        induk: row[1],
        nama: row[2].trim(),
        normNama: normalizeName(row[2].trim())
      });
    }
  }
  return result;
}

// GET: Summary analysis of sync status
export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const excelPath = path.join(process.cwd(), 'JADWAL MADIN 2026-2027.xlsx');
    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ error: 'File Excel JADWAL MADIN 2026-2027.xlsx tidak ditemukan di root project' }, { status: 404 });
    }

    const workbook = XLSX.readFile(excelPath);
    const putra = workbook.Sheets['PUTRA'] ? parseMadinSheet(workbook.Sheets['PUTRA'], 'Laki-laki') : [];
    const putri = workbook.Sheets['PUTRI'] ? parseMadinSheet(workbook.Sheets['PUTRI'], 'Perempuan') : [];
    const allExcel = [...putra, ...putri];

    const [dbClasses] = await pool.execute<RowDataPacket[]>('SELECT * FROM kelas_madin');
    const classNameToIdMap = new Map<string, number>();
    const classMap = new Map<number, string>();
    dbClasses.forEach(c => {
      const norm = c.nama_kelas.toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      classNameToIdMap.set(norm, c.kelas_id);
      classMap.set(c.kelas_id, c.nama_kelas);
    });

    const [dbMurid] = await pool.execute<RowDataPacket[]>('SELECT murid_id, nis, nama, jenis_kelamin, kelas_madin_id FROM murid');
    const dbMuridMap = new Map<string, RowDataPacket[]>();
    const dbMuridList: any[] = dbMurid.map(m => ({
      murid_id: m.murid_id,
      nis: m.nis,
      nama: m.nama,
      jenis_kelamin: m.jenis_kelamin,
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
      const normExClass = (ex.classInSheet || '').toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      const targetClassId = classNameToIdMap.get(normExClass) || null;

      let dbSantri = matches ? matches[0] : null;

      if (!dbSantri) {
        // Try fuzzy match (>80%)
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const targetGender = body.targetGender; // 'Laki-laki' | 'Perempuan' | undefined (all)

    const excelPath = path.join(process.cwd(), 'JADWAL MADIN 2026-2027.xlsx');
    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ error: 'File Excel JADWAL MADIN 2026-2027.xlsx tidak ditemukan' }, { status: 404 });
    }

    const workbook = XLSX.readFile(excelPath);
    let putra = workbook.Sheets['PUTRA'] ? parseMadinSheet(workbook.Sheets['PUTRA'], 'Laki-laki') : [];
    let putri = workbook.Sheets['PUTRI'] ? parseMadinSheet(workbook.Sheets['PUTRI'], 'Perempuan') : [];

    if (targetGender === 'Laki-laki') {
      putri = [];
    } else if (targetGender === 'Perempuan') {
      putra = [];
    }
    const allExcel = [...putra, ...putri];

    const [dbClasses] = await pool.execute<RowDataPacket[]>('SELECT * FROM kelas_madin');
    const classNameToIdMap = new Map<string, number>();
    dbClasses.forEach(c => {
      const norm = c.nama_kelas.toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      classNameToIdMap.set(norm, c.kelas_id);
    });

    const [dbMurid] = await pool.execute<RowDataPacket[]>('SELECT murid_id, nis, nama, jenis_kelamin, kelas_madin_id FROM murid');
    const dbMuridMap = new Map<string, RowDataPacket[]>();
    const dbMuridList: any[] = dbMurid.map(m => ({
      murid_id: m.murid_id,
      nis: m.nis,
      nama: m.nama,
      jenis_kelamin: m.jenis_kelamin,
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
      const normExClass = (ex.classInSheet || '').toUpperCase().replace(/[\(\)]/g, '').replace(/\s+/g, ' ');
      const targetClassId = classNameToIdMap.get(normExClass) || null;

      let dbSantri = matches ? matches[0] : null;

      if (!dbSantri) {
        // Try fuzzy match (>80%)
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

