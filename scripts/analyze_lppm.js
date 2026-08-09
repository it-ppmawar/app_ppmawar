const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');

async function analyzeLPPM() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  console.log('=== CEK DATA KAMAR ASRAMA ===');
  const [kamars] = await conn.execute('SELECT k.kamar_id, k.nama_kamar, k.nama_asrama, (SELECT COUNT(*) FROM murid m WHERE m.kamar_id = k.kamar_id) as jumlah_murid FROM kamar k ORDER BY k.nama_asrama, k.nama_kamar');
  console.table(kamars);

  console.log('\n=== STATISTIK UTAMA MURID ===');
  const [stats] = await conn.execute(`
    SELECT 
      COUNT(*) as total_murid,
      SUM(IF(kamar_id IS NOT NULL, 1, 0)) as punya_kamar,
      SUM(IF(kamar_id IS NULL, 1, 0)) as tanpa_kamar,
      SUM(IF(kelas_madin_id IS NOT NULL, 1, 0)) as punya_madin,
      SUM(IF(kelas_madin_id IS NULL, 1, 0)) as tanpa_madin,
      SUM(IF(kelas_quran_id IS NOT NULL, 1, 0)) as punya_quran,
      SUM(IF(kelas_quran_id IS NULL, 1, 0)) as tanpa_quran,
      SUM(IF(kamar_id IS NULL AND kelas_madin_id IS NULL AND kelas_quran_id IS NULL, 1, 0)) as tanpa_semua_3
    FROM murid
  `);
  console.log(stats[0]);

  // Cek 812 santri tanpa kelas madin: berapa yang punya kamar, berapa yang tidak punya kamar
  console.log('\n=== CROSS TAB 812 SANTRI TANPA KELAS MADIN ===');
  const [crossTab] = await conn.execute(`
    SELECT 
      IF(m.kamar_id IS NOT NULL, k.nama_asrama, 'Tanpa Kamar/LPPM') as status_asrama,
      COUNT(*) as jumlah
    FROM murid m
    LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
    WHERE m.kelas_madin_id IS NULL
    GROUP BY status_asrama
  `);
  console.table(crossTab);

  // Cek apakah ada kamar dengan kata LPPM / Luar / Kalong / Non Mukim
  const [lppmKamar] = await conn.execute(`
    SELECT m.murid_id, m.nama, m.nis, k.nama_kamar, k.nama_asrama
    FROM murid m
    JOIN kamar k ON m.kamar_id = k.kamar_id
    WHERE LOWER(k.nama_kamar) LIKE '%lppm%' OR LOWER(k.nama_asrama) LIKE '%lppm%' OR LOWER(k.nama_kamar) LIKE '%luar%' OR LOWER(k.nama_asrama) LIKE '%luar%'
  `);
  console.log('\nMurid di Kamar/Asrama LPPM/Luar:', lppmKamar.length);

  await conn.end();
}

analyzeLPPM().catch(e => console.error(e));
