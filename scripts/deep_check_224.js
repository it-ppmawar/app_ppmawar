const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');
const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');

// Levenshtein distance helper
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

async function deepCheck224() {
  const wb = xlsx.readFile('D:/koding/app.ppmawar/data_madin/SANTRI BARU FIKS 2025-1.xlsx');
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  const sheet = wb.Sheets['PEGANGAN SANTRI'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const santriList = [];
  let currentKelas = '';

  rows.forEach((r, idx) => {
    r.forEach((cell) => {
      const s = String(cell || '').trim();
      if (s.match(/^(1|2|3)\s+(ULA|WUSTHO|MAK)\b/i) || s.match(/^TQ\b/i)) {
        currentKelas = s;
      }
    });

    const noUrut = parseInt(r[0]);
    const namaStr = String(r[2] || '').trim();

    if (!isNaN(noUrut) && noUrut > 0 && namaStr && !namaStr.toUpperCase().includes('NAMA') && !namaStr.toUpperCase().includes('JUMLAH')) {
      santriList.push({
        no: noUrut,
        induk: String(r[1] || '').trim(),
        nama: namaStr,
        kelas: currentKelas
      });
    }
  });

  // Database murid
  const [dbMurid] = await conn.execute(`
    SELECT m.murid_id, m.nama, m.nis, m.jenis_kelamin, m.kelas_madin_id,
           km.nama_kelas as kelas_madin_db
    FROM murid m
    LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
  `);

  console.log('=== FUZZY MATCHING CEK TYPO 268 SANTRI ===');

  const exactMatch = [];
  const fuzzyMatch = [];
  const trulyNew = [];

  const dbMapExact = new Map();
  dbMurid.forEach(m => dbMapExact.set(m.nama.toUpperCase().trim(), m));

  santriList.forEach(s => {
    const norm = s.nama.toUpperCase().trim();
    if (dbMapExact.has(norm)) {
      const m = dbMapExact.get(norm);
      exactMatch.push({ ...s, db: m });
    } else {
      // Try fuzzy match
      let bestMatch = null;
      let minDist = 999;

      dbMurid.forEach(m => {
        const dbNorm = m.nama.toUpperCase().trim();
        if (Math.abs(dbNorm.length - norm.length) <= 3) {
          const dist = levenshtein(norm, dbNorm);
          if (dist < minDist && dist <= 3) {
            minDist = dist;
            bestMatch = { db: m, dist };
          }
        }
      });

      if (bestMatch && bestMatch.dist <= 2) {
        fuzzyMatch.push({ ...s, db: bestMatch.db, dist: bestMatch.dist });
      } else {
        trulyNew.push(s);
      }
    }
  });

  console.log(`Exact Match  : ${exactMatch.length} santri (Sudah persis di DB)`);
  console.log(`Fuzzy Match  : ${fuzzyMatch.length} santri (Beda ejaan/typo)`);
  console.log(`Murni Baru   : ${trulyNew.length} santri (Siap di-insert ke DB)`);

  if (fuzzyMatch.length > 0) {
    console.log('\n--- CONTOH BEDA EJAAN (FUZZY MATCH) ---');
    fuzzyMatch.forEach(f => {
      console.log(`  File: "${f.nama}" → DB: "${f.db.nama}" (NIS: ${f.db.nis}) | Dist: ${f.dist}`);
    });
  }

  await conn.end();
}

deepCheck224().catch(e => console.error(e));
