const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Parse .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppmawaro_absensi_ppma',
  });

  console.log('Menjalankan migrasi database...');

  const queries = [
    // 1. Tambah barcode_id di tabel murid
    "ALTER TABLE murid ADD COLUMN IF NOT EXISTS barcode_id VARCHAR(255) DEFAULT NULL UNIQUE;",
    
    // 2. Tambah nama_panggilan di tabel murid
    "ALTER TABLE murid ADD COLUMN IF NOT EXISTS nama_panggilan VARCHAR(50) DEFAULT NULL;",
    
    // 3. Tambah nama_asrama di tabel kamar
    "ALTER TABLE kamar ADD COLUMN IF NOT EXISTS nama_asrama VARCHAR(100) DEFAULT NULL;",

    // 4. Tambah barcode_id di tabel guru (untuk Guru, Pengurus, Sesepuh)
    "ALTER TABLE guru ADD COLUMN IF NOT EXISTS barcode_id VARCHAR(255) DEFAULT NULL UNIQUE;"
  ];

  for (const query of queries) {
    try {
      await connection.execute(query);
      console.log(`[SUCCESS]: ${query}`);
    } catch (err) {
      // Jika MariaDB/MySQL versi lama tidak support ADD COLUMN IF NOT EXISTS,
      // kita tangani error duplicate column name
      if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
        console.log(`[ALREADY EXISTS]: ${query}`);
      } else {
        console.error(`[ERROR]: ${query}`, err.message);
      }
    }
  }

  await connection.end();
  console.log('Migrasi selesai!');
}

main().catch(console.error);
