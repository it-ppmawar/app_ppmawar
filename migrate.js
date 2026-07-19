const mysql = require('mysql2/promise');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppmawaro_app_ppma'
  });

  try {
    console.log("Adding petugas_sarpras role...");
    await connection.execute(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin','staff','guru','tamu','wali_murid','pengasuh','petugas_sarpras', 'pengurus_asrama') NOT NULL DEFAULT 'tamu'
    `);
    console.log("Modified users table successfully.");
  } catch(e) {
    console.log("Error modifying users:", e.message);
  }

  try {
    console.log("Creating inventaris table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventaris (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_barang VARCHAR(255) NOT NULL,
        kategori VARCHAR(100) NOT NULL,
        asrama VARCHAR(50) NOT NULL,
        kamar_id INT DEFAULT NULL,
        jumlah INT DEFAULT 1,
        kondisi ENUM('Baik', 'Rusak Ringan', 'Rusak Berat') DEFAULT 'Baik',
        keterangan TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (kamar_id) REFERENCES kamar(kamar_id) ON DELETE SET NULL
      )
    `);
    console.log("Created inventaris table.");
  } catch(e) {
    console.log("Error creating inventaris table:", e.message);
  }

  try {
    console.log("Creating laporan_kerusakan table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS laporan_kerusakan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inventaris_id INT NOT NULL,
        pelapor_id INT NOT NULL,
        petugas_id INT DEFAULT NULL,
        deskripsi_masalah TEXT NOT NULL,
        status ENUM('Dilaporkan', 'Diproses', 'Selesai', 'Dibatalkan') DEFAULT 'Dilaporkan',
        tindakan_perbaikan TEXT DEFAULT NULL,
        tanggal_selesai TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (inventaris_id) REFERENCES inventaris(id) ON DELETE CASCADE,
        FOREIGN KEY (pelapor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log("Created laporan_kerusakan table.");
  } catch(e) {
    console.log("Error creating laporan_kerusakan table:", e.message);
  }

  await connection.end();
  console.log("Migration complete.");
}

migrate();
