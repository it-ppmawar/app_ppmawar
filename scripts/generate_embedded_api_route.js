const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');
const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');
const fs = require('fs');

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const KELAS_MAP = {
  '1 ULA A PUTRI': 24,
  '1 ULA B PUTRI': 25,
  '1 ULA C PUTRI': 26,
  '1 WUSTHO A PUTRI': 14,
  '1 WUSTHO B PUTRI': 15,
  '1 WUSTHO C PUTRI': 16,
};

async function generateEmbeddedApiRoute() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  const wb = xlsx.readFile('D:/koding/app.ppmawar/data_madin/SANTRI BARU FIKS 2025-1.xlsx');
  const sheet = wb.Sheets['PEGANGAN SANTRI'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const santriFile = [];
  let currentKelasStr = '';

  rows.forEach((r) => {
    r.forEach((cell) => {
      const s = String(cell || '').trim();
      if (s.match(/^(1|2|3)\s+(ULA|WUSTHO|MAK)\b/i) || s.match(/^TQ\b/i)) {
        currentKelasStr = s;
      }
    });

    const noUrut = parseInt(r[0]);
    const namaStr = String(r[2] || '').trim();

    if (!isNaN(noUrut) && noUrut > 0 && namaStr && !namaStr.toUpperCase().includes('NAMA') && !namaStr.toUpperCase().includes('JUMLAH')) {
      const normKelasKey = currentKelasStr.toUpperCase().replace(/\(|\)/g, '').trim();
      let matchedKelasId = null;

      Object.keys(KELAS_MAP).forEach(k => {
        if (normKelasKey.includes(k)) matchedKelasId = KELAS_MAP[k];
      });

      santriFile.push({
        nama: namaStr,
        kelasNama: currentKelasStr,
        kelasId: matchedKelasId
      });
    }
  });

  const [dbMurid] = await conn.execute(`SELECT murid_id, nama, nis, kelas_madin_id FROM murid`);

  let lastNisNum = 7000;
  dbMurid.forEach(m => {
    if (m.nis && m.nis.startsWith('202507')) {
      const num = parseInt(m.nis.slice(6));
      if (!isNaN(num) && num > lastNisNum) lastNisNum = num;
    }
  });

  const updates = [];
  const inserts = [];

  santriFile.forEach(s => {
    const norm = s.nama.toUpperCase().trim();
    let found = dbMurid.find(m => m.nama.toUpperCase().trim() === norm);

    if (!found) {
      dbMurid.forEach(m => {
        const dbNorm = m.nama.toUpperCase().trim();
        if (Math.abs(dbNorm.length - norm.length) <= 3) {
          const dist = levenshtein(norm, dbNorm);
          if (dist <= 2) found = m;
        }
      });
    }

    if (found) {
      updates.push({
        nis: found.nis,
        nama: found.nama,
        kelas_id: s.kelasId
      });
    } else {
      lastNisNum++;
      const generatedNis = `202507${String(lastNisNum).padStart(4, '0')}`;
      inserts.push({
        nama: s.nama.trim().toUpperCase(),
        nis: generatedNis,
        kelas_id: s.kelasId
      });
    }
  });

  console.log(`Updates count: ${updates.length}, Inserts count: ${inserts.length}`);

  // Build TS code for route.ts with embedded data
  const tsCode = `import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/migrate-santri-baru-2025
 * Migrasi 268 Santri Baru Tadris 2025/2026:
 * - Update kelas madin ${updates.length} santri terdaftar
 * - Insert ${inserts.length} santri murni baru ke DB cPanel
 * Pure In-Memory Code (Bebas ketergantungan file disk). Safe & Idempotent.
 */

const UPDATES: Array<{ nis: string; kelas_id: number }> = ${JSON.stringify(updates.map(u => ({ nis: u.nis, kelas_id: u.kelas_id })), null, 2)};

const INSERTS: Array<{ nama: string; nis: string; kelas_id: number }> = ${JSON.stringify(inserts.map(i => ({ nama: i.nama, nis: i.nis, kelas_id: i.kelas_id })), null, 2)};

export async function GET() {
  try {
    let updatedCount = 0;
    let insertedCount = 0;
    let alreadyCorrectCount = 0;

    // 1. Eksekusi Updates
    for (const u of UPDATES) {
      if (!u.nis || !u.kelas_id) continue;
      const [rows]: any = await pool.execute('SELECT kelas_madin_id FROM murid WHERE nis = ?', [u.nis]);
      if (rows.length > 0) {
        if (rows[0].kelas_madin_id === u.kelas_id) {
          alreadyCorrectCount++;
        } else {
          await pool.execute('UPDATE murid SET kelas_madin_id = ?, updated_at = NOW() WHERE nis = ?', [u.kelas_id, u.nis]);
          updatedCount++;
        }
      }
    }

    // 2. Eksekusi Inserts
    for (const ins of INSERTS) {
      if (!ins.nis || !ins.kelas_id || !ins.nama) continue;
      const [rows]: any = await pool.execute('SELECT murid_id FROM murid WHERE nis = ?', [ins.nis]);
      if (rows.length > 0) {
        alreadyCorrectCount++;
      } else {
        await pool.execute(
          \`INSERT INTO murid (nama, nis, jenis_kelamin, kelas_madin_id, created_at, updated_at)
           VALUES (?, ?, 'Perempuan', ?, NOW(), NOW())\`,
          [ins.nama, ins.nis, ins.kelas_id]
        );
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migrasi 268 Santri Baru Tadris 2025/2026 BERHASIL SELESAI!',
      detail: {
        total_santri_diproses: ${santriFile.length},
        berhasil_update_kelas: updatedCount,
        berhasil_insert_baru: insertedCount,
        sudah_sesuai_sebelumnya: alreadyCorrectCount
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
`;

  const routePath = 'D:/koding/app.ppmawar/src/app/api/migrate-santri-baru-2025/route.ts';
  fs.writeFileSync(routePath, tsCode, 'utf8');
  console.log(`✅ Embedded Route.ts Berhasil Ditulis ke: ${routePath}`);

  await conn.end();
}

generateEmbeddedApiRoute().catch(e => console.error(e));
