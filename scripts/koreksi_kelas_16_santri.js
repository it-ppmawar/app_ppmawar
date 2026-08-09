const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');

// Mapping yang BENAR berdasarkan DB
// kelas_id - nama_kelas
// 16 - 1 WUSTHO (C) PUTRI   ← bukan 1 WUSTHO A PUTRI!
// 14 - 1 WUSTHO (A) PUTRI
// 19 - 2 WUSTHO (B) PUTRI   ← yang dipakai untuk insert Shelsya & Tsaniyah (salah, harusnya 16)
// 38 - TQ PUTRI 2            ← bukan 3 ULA B PUTRI!
// 31 - 3 ULA (B) PUTRI       ← yang benar untuk 3 ULA B PUTRI

// KOREKSI:
// KHANSA NABIIHAH  → 1 WUSTHO (A) PUTRI = kelas_id 14 (bukan 16)
// NAURAH KUNIATUN  → 3 ULA (B) PUTRI    = kelas_id 31 (bukan 38)
// SHELSYA          → 1 WUSTHO (C) PUTRI = kelas_id 16 (bukan 19)
// TSANIYAH         → 1 WUSTHO (C) PUTRI = kelas_id 16 (bukan 19)
// ZAIMAH LULUK     → 2 WUSTHO (B) PUTRI = kelas_id 19 (bukan 22) -- wait, 22 = 3 WUSTHO (B) PUTRI!

const koreksi = [
  { nis: '2024070669', nama: 'KHANSA NABIIHAA SAKHI NURROHIM', kelas_id_benar: 14, kelas: '1 WUSTHO (A) PUTRI' },
  { nis: '2024070623', nama: 'NAURAH KHUNIATUN MUBAYYINA',     kelas_id_benar: 31, kelas: '3 ULA (B) PUTRI' },
  { nis: '2026060161', nama: 'SHELSYA KANNAH CYBIELLAH',       kelas_id_benar: 16, kelas: '1 WUSTHO (C) PUTRI' },
  { nis: '2026060162', nama: 'TSANIYAH NAILATUL IZZA',         kelas_id_benar: 16, kelas: '1 WUSTHO (C) PUTRI' },
  { nis: '2025070210', nama: 'ZAIMAH LULU AZKIYAH',            kelas_id_benar: 19, kelas: '2 WUSTHO (B) PUTRI' },
];

async function koreksiKelas() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  console.log('=== KOREKSI KELAS_ID (Fix Mapping Error) ===\n');

  for (const k of koreksi) {
    const [rows] = await conn.execute(
      'SELECT murid_id, nama, kelas_madin_id, (SELECT nama_kelas FROM kelas_madin WHERE kelas_id = murid.kelas_madin_id) as kelas_skrg FROM murid WHERE nis = ?',
      [k.nis]
    );
    if (rows.length === 0) { console.log(`❌ NIS ${k.nis} tidak ditemukan`); continue; }
    const r = rows[0];

    if (r.kelas_madin_id === k.kelas_id_benar) {
      console.log(`✅ ${r.nama} → sudah benar di ${k.kelas}`);
      continue;
    }

    await conn.execute('UPDATE murid SET kelas_madin_id = ?, updated_at = NOW() WHERE nis = ?', [k.kelas_id_benar, k.nis]);
    console.log(`🔄 ${r.nama}`);
    console.log(`   ${r.kelas_skrg || 'NULL'} → ${k.kelas} ✅`);
  }

  // Verifikasi semua 9 santri yang diproses
  console.log('\n=== VERIFIKASI FINAL SEMUA SANTRI DIPROSES ===');
  const allNis = ['2024070669','2025070185','2024070623','2024070631','2024070043','2025070470','2025070210','2026060161','2026060162'];
  const [verif] = await conn.execute(
    `SELECT m.nama, m.nis, km.nama_kelas 
     FROM murid m LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id 
     WHERE m.nis IN (${allNis.map(()=>'?').join(',')}) ORDER BY m.nis`,
    allNis
  );
  verif.forEach(r => console.log(`  ✅ ${r.nis} | ${r.nama.padEnd(40)} | ${r.nama_kelas || 'NULL'}`));

  await conn.end();
  console.log('\n✅ Koreksi selesai!');
}

koreksiKelas().catch(e => console.error('Error:', e.message));
