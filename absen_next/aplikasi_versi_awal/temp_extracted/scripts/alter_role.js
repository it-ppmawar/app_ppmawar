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

  console.log("Menambahkan role 'pengurus_asrama' ke tabel users...");
  try {
    await connection.execute("ALTER TABLE users MODIFY COLUMN role ENUM('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama') NOT NULL");
    console.log("Berhasil alter tabel users!");
  } catch (err) {
    console.error("Gagal alter tabel:", err.message);
  }

  await connection.end();
}

main();
