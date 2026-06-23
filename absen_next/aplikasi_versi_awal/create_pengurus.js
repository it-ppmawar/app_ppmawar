const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ppmawaro_absensi_ppma'
  });

  const [kamars] = await conn.execute('SELECT * FROM kamar');
  console.log(`Ditemukan ${kamars.length} asrama/kamar.`);

  for (const kamar of kamars) {
    const username = `pengurus_${kamar.nama_kamar.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const passwordHash = await bcrypt.hash('asrama123', 10);
    const namaLengkap = `Pengurus Asrama ${kamar.nama_kamar}`;

    try {
      await conn.execute(
        'INSERT INTO users (username, password, role, nama_lengkap, kamar_id) VALUES (?, ?, ?, ?, ?)',
        [username, passwordHash, 'pengurus_asrama', namaLengkap, kamar.kamar_id]
      );
      console.log(`Berhasil membuat akun: ${username}`);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log(`Akun ${username} sudah ada, melewati...`);
      } else {
        console.error(`Gagal membuat akun ${username}:`, e.message);
      }
    }
  }

  await conn.end();
}

main();
