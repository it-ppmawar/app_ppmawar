const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');
const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');

async function parseSantriBaruFiksDetailed() {
  const wb = xlsx.readFile('D:/koding/app.ppmawar/data_madin/SANTRI BARU FIKS 2025-1.xlsx');
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  const sheet = wb.Sheets['PEGANGAN SANTRI'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log('=== ANALISIS LENGKAP SANTRI BARU FIKS 2025-1.xlsx ===');
  console.log('Total baris di sheet PEGANGAN SANTRI:', rows.length);

  const santriList = [];
  let currentKelas = '';

  rows.forEach((r, idx) => {
    // Check if row defines a class name
    // e.g. Col 19: "Kelas", Col 25: "1 Ula A Putri"
    // Or anywhere in row containing class pattern
    r.forEach((cell, cIdx) => {
      const s = String(cell || '').trim();
      if (s.match(/^(1|2|3)\s+(ULA|WUSTHO|MAK)\b/i) || s.match(/^TQ\b/i)) {
        currentKelas = s;
      }
    });

    const noUrut = parseInt(r[0]);
    const namaStr = String(r[2] || '').trim();

    // Check if this row is a valid student row
    if (!isNaN(noUrut) && noUrut > 0 && namaStr && !namaStr.toUpperCase().includes('NAMA') && !namaStr.toUpperCase().includes('JUMLAH')) {
      santriList.push({
        no: noUrut,
        induk: String(r[1] || '').trim(),
        nama: namaStr,
        kelas: currentKelas,
        rowIdx: idx + 1
      });
    }
  });

  console.log(`\nTotal santri berhasil di-parse: ${santriList.length}`);
  console.log('\nDistribusi per Kelas:');
  const classDist = {};
  santriList.forEach(s => {
    classDist[s.kelas || '(Tanpa Kelas)'] = (classDist[s.kelas || '(Tanpa Kelas)'] || 0) + 1;
  });
  console.table(classDist);

  // Ambil data murid dari DB
  const [dbMurid] = await conn.execute(`
    SELECT m.murid_id, m.nama, m.nis, m.jenis_kelamin, m.kelas_madin_id,
           km.nama_kelas as kelas_madin_db, m.kamar_id, k.nama_asrama
    FROM murid m
    LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
    LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
  `);

  // Index DB murid by normalized name
  const dbNameMap = new Map();
  dbMurid.forEach(m => {
    const norm = m.nama.toUpperCase().trim();
    if (!dbNameMap.has(norm)) dbNameMap.set(norm, []);
    dbNameMap.get(norm).push(m);
  });

  const matched = [];
  const unmatchedNew = [];

  santriList.forEach(s => {
    const norm = s.nama.toUpperCase().trim();
    const foundInDb = dbNameMap.get(norm);

    if (foundInDb && foundInDb.length > 0) {
      matched.push({
        file_nama: s.nama,
        file_kelas: s.kelas,
        db_murid_id: foundInDb[0].murid_id,
        db_nama: foundInDb[0].nama,
        db_nis: foundInDb[0].nis,
        db_kelas_skrg: foundInDb[0].kelas_madin_db || '(Kosong)',
        db_asrama: foundInDb[0].nama_asrama || '(Non-Mukim/LPPM)'
      });
    } else {
      unmatchedNew.push(s);
    }
  });

  console.log('\n=== MATCHING RESULT WITH DB ===');
  console.log(`✅ Santri yang SUDAH ADA di DB    : ${matched.length}`);
  console.log(`🆕 Santri BARU (BELUM ADA di DB)  : ${unmatchedNew.length}`);

  // Cek dari santri yang sudah ada di DB: berapa yang kelas madin-nya perlu di-update
  const needClassUpdate = matched.filter(m => {
    // Normalisasi nama kelas
    return m.db_kelas_skrg !== m.file_kelas;
  });
  console.log(`🔄 Santri di DB yang perlu Penyesuaian Kelas Madin: ${needClassUpdate.length}`);

  if (unmatchedNew.length > 0) {
    console.log('\n=== SAMPLE SANTRI BARU YANG BELUM ADA DI DB (Top 15) ===');
    console.table(unmatchedNew.slice(0, 15));
  }

  // Save detailed result to Excel report
  const wbOut = xlsx.utils.book_new();

  const ws1Data = matched.map((m, i) => ({
    'No': i + 1,
    'Nama Santri (File)': m.file_nama,
    'Kelas di File': m.file_kelas,
    'NIS DB': m.db_nis,
    'Nama DB': m.db_nama,
    'Kelas Madin DB Saat Ini': m.db_kelas_skrg,
    'Asrama': m.db_asrama,
    'Status Kelas': m.db_kelas_skrg === m.file_kelas ? 'SUDAH SESUAI ✅' : 'PERLU UPDATE KELAS 🔄'
  }));
  const ws1 = xlsx.utils.json_to_sheet(ws1Data);
  xlsx.utils.book_append_sheet(wbOut, ws1, 'Santri Sudah Ada di DB');

  const ws2Data = unmatchedNew.map((s, i) => ({
    'No': i + 1,
    'Nama Santri Baru': s.nama,
    'Kelas Target': s.kelas,
    'No Induk/NIS File': s.induk || '-',
    'Status': 'SANTRI BARU - PERLU DI-INSERT 🆕'
  }));
  const ws2 = xlsx.utils.json_to_sheet(ws2Data);
  xlsx.utils.book_append_sheet(wbOut, ws2, 'Santri Murni Baru (Belum Ada)');

  const outPath = 'D:/koding/app.ppmawar/data_madin/HASIL_AUDIT_SANTRI_BARU_FIKS_2025.xlsx';
  xlsx.writeFile(wbOut, outPath);
  console.log(`\n✅ File Hasil Audit Berhasil Dibuat: ${outPath}`);

  await conn.end();
}

parseSantriBaruFiksDetailed().catch(e => console.error(e));
