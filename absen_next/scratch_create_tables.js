const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load environment variables manually (tanpa dependency dotenv)
function loadEnvFile(filePath) {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return;
    const content = fs.readFileSync(absPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      // Hapus tanda kutip jika ada
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    // Abaikan jika file tidak ditemukan
  }
}

loadEnvFile('./.env.local');
loadEnvFile('./.env');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppmawaro_absensi_ppma',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
  });

  console.log('Koneksi database berhasil!');

  const queries = [
    `CREATE TABLE IF NOT EXISTS jadwal_alumni (
      id INT AUTO_INCREMENT PRIMARY KEY,
      jam_mulai TIME NOT NULL,
      jam_selesai TIME NOT NULL,
      kegiatan VARCHAR(255) NOT NULL,
      tempat VARCHAR(255) NOT NULL,
      keterangan TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS jurnal_madin (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tanggal DATE NOT NULL,
      guru_id INT NOT NULL,
      kelas_id INT NOT NULL,
      materi TEXT NOT NULL,
      catatan TEXT NOT NULL,
      kendala TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS jurnal_quran (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tanggal DATE NOT NULL,
      guru_id INT NOT NULL,
      kelas_quran_id INT NOT NULL,
      materi TEXT NOT NULL,
      catatan TEXT NOT NULL,
      kendala TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS jurnal_kamar (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tanggal DATE NOT NULL,
      pembina_id INT NOT NULL,
      kamar_id INT NOT NULL,
      kegiatan TEXT NOT NULL,
      catatan TEXT NOT NULL,
      kendala TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  ];

  for (const query of queries) {
    const tableName = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    try {
      await connection.query(query);
      console.log(`✓ Tabel ${tableName} siap/dibuat`);
    } catch (err) {
      console.error(`✗ Gagal membuat tabel ${tableName}:`, err.message);
    }
  }

  await connection.end();
}

main().catch(err => {
  console.error('Terjadi kesalahan:', err.message);
});
