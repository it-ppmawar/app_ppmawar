const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');

async function cek() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  const [[total]] = await conn.execute('SELECT COUNT(*) as n FROM murid');
  const [[denganFoto]] = await conn.execute("SELECT COUNT(*) as n FROM murid WHERE foto IS NOT NULL AND foto != '-' AND foto != ''");
  const [[denganKelas]] = await conn.execute('SELECT COUNT(*) as n FROM murid WHERE kelas_madin_id IS NOT NULL');
  const [[faceEnrolled]] = await conn.execute('SELECT COUNT(*) as n FROM murid_face');
  const [kelasDistrib] = await conn.execute('SELECT km.nama_kelas, COUNT(m.murid_id) as jumlah FROM murid m LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id WHERE m.kelas_madin_id IS NOT NULL GROUP BY km.nama_kelas ORDER BY km.nama_kelas');

  console.log('=== STATUS DATABASE SANTRI ===');
  console.log('Total santri        :', total.n);
  console.log('Dengan foto         :', denganFoto.n);
  console.log('Dengan kelas madin  :', denganKelas.n);
  console.log('Face AI enrolled    :', faceEnrolled.n);
  console.log('');
  console.log('=== DISTRIBUSI KELAS MADIN ===');
  let totalPerKelas = 0;
  kelasDistrib.forEach(k => {
    console.log('  -', k.nama_kelas.padEnd(25), ':', k.jumlah, 'santri');
    totalPerKelas += k.jumlah;
  });
  console.log('  Total per kelas   :', totalPerKelas, 'santri');

  await conn.end();
}

cek().catch(e => console.error(e.message));
