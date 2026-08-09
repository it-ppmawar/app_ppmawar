const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');
const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');

async function parseSantriBaruFiks() {
  const wb = xlsx.readFile('D:/koding/app.ppmawar/data_madin/SANTRI BARU FIKS 2025-1.xlsx');
  console.log('=== ANALISIS FILE: SANTRI BARU FIKS 2025-1.xlsx ===');
  console.log('Semua Sheet:', wb.SheetNames);

  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  const parsedStudents = [];

  wb.SheetNames.forEach(sheetName => {
    const rawData = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    let currentKelas = '';

    rawData.forEach((row, idx) => {
      if (!row || row.length === 0) return;

      const rowStr = row.map(cell => String(cell || '').trim()).join(' | ');

      // Cek apakah ini header kelas (misal "Kelas : 1 Ula A Putri" atau "1 Ula A Putri")
      row.forEach(cell => {
        const str = String(cell || '').trim();
        if (str.match(/^(1|2|3)\s+(ULA|WUSTHO|MAK)\b/i) || str.match(/^TQ\b/i)) {
          currentKelas = str;
        }
      });

      // Cari kolom yang mungkin berisi Nama Santri
      // Biasanya baris yang berisi nama santri memiliki nomor urut di awal dan string nama
      const noUrut = parseInt(row[0]) || parseInt(row[1]);
      const namaCandidate = row.find((cell, cellIdx) => {
        const str = String(cell || '').trim();
        return str.length > 3 && !str.match(/MADRASAH|ABSENSI|NILAI|DAFTAR|Hadir|Nama Santri|Pertemuan|KUMPULAN|TADRIS|Guru|Mata Pelajaran|Semester|PENGETAHUAN|KETRAMPILAN|SIKAP|Urut|Induk|Kel/i) && isNaN(str);
      });

      if (namaCandidate) {
        const nama = String(namaCandidate).trim();
        // Cek NIS/Induk jika ada di row
        const nis = row.find(c => {
          const s = String(c || '').trim();
          return s.length >= 8 && !isNaN(s);
        }) || '';

        parsedStudents.push({
          sheet: sheetName,
          rowIdx: idx + 1,
          nama,
          nis,
          kelasDetected: currentKelas
        });
      }
    });
  });

  console.log(`\nTotal entri nama ditemukan dari file: ${parsedStudents.length}`);
  console.log('Sample 10 entri pertama:');
  console.table(parsedStudents.slice(0, 10));

  // Cek pencocokan dengan database
  const [dbStudents] = await conn.execute('SELECT murid_id, nama, nis, kelas_madin_id FROM murid');
  const dbNameSet = new Set(dbStudents.map(m => m.nama.toUpperCase().trim()));

  let matchedCount = 0;
  let unMatchedCount = 0;
  const unmatched = [];

  parsedStudents.forEach(s => {
    const norm = s.nama.toUpperCase().trim();
    if (dbNameSet.has(norm)) {
      matchedCount++;
    } else {
      unMatchedCount++;
      unmatched.push(s);
    }
  });

  console.log(`\n=== MATCHING DENGAN DATABASE ===`);
  console.log(`Pernah/Sudah ada di DB  : ${matchedCount}`);
  console.log(`Belum ada di DB (BARU)   : ${unMatchedCount}`);

  if (unmatched.length > 0) {
    console.log('\nUnmatched Sample (15):');
    console.table(unmatched.slice(0, 15));
  }

  await conn.end();
}

parseSantriBaruFiks().catch(e => console.error(e));
