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

// Mapping nama kelas di Excel ke kelas_id DB
const KELAS_MAP = {
  '1 ULA A PUTRI': 24,
  '1 ULA B PUTRI': 25,
  '1 ULA C PUTRI': 26,
  '1 WUSTHO A PUTRI': 14,
  '1 WUSTHO B PUTRI': 15,
  '1 WUSTHO C PUTRI': 16,
};

async function prosesSantriBaru() {
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
        kelasId: matchedKelasId,
        induk: String(r[1] || '').trim()
      });
    }
  });

  console.log('=== PEMPROSESAN 268 SANTRI BARU FIKS 2025-1 ===');
  console.log(`Total santri di file: ${santriFile.length}`);

  // Fetch all existing DB murid
  const [dbMurid] = await conn.execute(`
    SELECT murid_id, nama, nis, kelas_madin_id FROM murid
  `);

  // Max NIS counter untuk NIS otomatis baru (Prefix: 202507)
  let lastNisNum = 7000;
  dbMurid.forEach(m => {
    if (m.nis && m.nis.startsWith('202507')) {
      const num = parseInt(m.nis.slice(6));
      if (!isNaN(num) && num > lastNisNum) lastNisNum = num;
    }
  });

  const updates = []; // { murid_id, nama, nis, kelas_id, kelas_nama }
  const inserts = []; // { nama, nis, kelas_id, kelas_nama }

  santriFile.forEach(s => {
    const norm = s.nama.toUpperCase().trim();
    let found = dbMurid.find(m => m.nama.toUpperCase().trim() === norm);

    if (!found) {
      // Try fuzzy matching (distance <= 2)
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
        murid_id: found.murid_id,
        nama: found.nama,
        nis: found.nis,
        kelas_id: s.kelasId,
        kelas_nama: s.kelasNama
      });
    } else {
      lastNisNum++;
      const generatedNis = `202507${String(lastNisNum).padStart(4, '0')}`;
      inserts.push({
        nama: s.nama.trim().toUpperCase(),
        nis: generatedNis,
        kelas_id: s.kelasId,
        kelas_nama: s.kelasNama
      });
    }
  });

  console.log(`\n📋 Ringkasan Pemrosesan:`);
  console.log(`  - Santri Terdaftar di DB (Update Kelas): ${updates.length}`);
  console.log(`  - Santri Murni Baru (Insert to DB)      : ${inserts.length}`);

  // Eksekusi Update ke Database Lokal
  console.log('\n🔄 Memperbarui kelas madin untuk santri yang sudah terdaftar...');
  let updateCount = 0;
  for (const u of updates) {
    if (u.kelas_id) {
      await conn.execute('UPDATE murid SET kelas_madin_id = ?, updated_at = NOW() WHERE murid_id = ?', [u.kelas_id, u.murid_id]);
      updateCount++;
    }
  }
  console.log(`✅ Berhasil memperbarui ${updateCount} santri lokal.`);

  // Eksekusi Insert ke Database Lokal
  console.log('\n➕ Memasukkan santri murni baru ke database lokal...');
  let insertCount = 0;
  for (const ins of inserts) {
    if (ins.kelas_id) {
      await conn.execute(
        `INSERT INTO murid (nama, nis, jenis_kelamin, kelas_madin_id, created_at, updated_at)
         VALUES (?, ?, 'Perempuan', ?, NOW(), NOW())`,
        [ins.nama, ins.nis, ins.kelas_id]
      );
      insertCount++;
    }
  }
  console.log(`✅ Berhasil menambahkan ${insertCount} santri murni baru ke database lokal.`);

  // Generasi File SQL untuk Production cPanel
  let sqlContent = `-- ============================================================
-- MIGRASI 268 SANTRI BARU TADRIS 2025/2026
-- Tanggal: 2026-08-06
-- Sumber: SANTRI BARU FIKS 2025-1.xlsx
-- ============================================================

-- 1. UPDATE KELAS SANTRI YANG SUDAH TERDAFTAR (${updates.length} SANTRI)
`;

  updates.forEach(u => {
    if (u.kelas_id && u.nis) {
      sqlContent += `UPDATE murid SET kelas_madin_id = ${u.kelas_id}, updated_at = NOW() WHERE nis = '${u.nis}'; -- ${u.nama} -> ${u.kelas_nama}\n`;
    }
  });

  sqlContent += `\n-- 2. INSERT SANTRI MURNI BARU (${inserts.length} SANTRI)\n`;
  inserts.forEach(ins => {
    if (ins.kelas_id) {
      const cleanNama = ins.nama.replace(/'/g, "''");
      sqlContent += `INSERT INTO murid (nama, nis, jenis_kelamin, kelas_madin_id, created_at, updated_at) SELECT '${cleanNama}', '${ins.nis}', 'Perempuan', ${ins.kelas_id}, NOW(), NOW() WHERE NOT EXISTS (SELECT 1 FROM murid WHERE nis = '${ins.nis}');\n`;
    }
  });

  const sqlPath = 'D:/koding/app.ppmawar/data_madin/MIGRASI_SANTRI_BARU_FIKS_2025.sql';
  fs.writeFileSync(sqlPath, sqlContent, 'utf8');
  console.log(`\n✅ File Production SQL Berhasil Dibuat: ${sqlPath}`);

  await conn.end();
}

prosesSantriBaru().catch(e => console.error('Error:', e));
