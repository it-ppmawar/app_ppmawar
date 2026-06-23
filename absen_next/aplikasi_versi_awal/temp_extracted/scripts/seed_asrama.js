const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

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

  console.log("Memulai proses pembuatan akun asrama...");

  try {
    // 1. Ambil semua kamar
    const [kamarList] = await connection.execute('SELECT kamar_id, nama_kamar FROM kamar');
    
    // Kelompokkan berdasarkan huruf pertama
    const asramaGroups = new Set();
    
    for (let kamar of kamarList) {
      if (kamar.nama_kamar) {
        // Ambil karakter pertama
        const prefix = kamar.nama_kamar.charAt(0).toUpperCase();
        const namaAsrama = `Asrama ${prefix}`;
        asramaGroups.add(namaAsrama);
        
        // Update nama_asrama di tabel kamar
        await connection.execute('UPDATE kamar SET nama_asrama = ? WHERE kamar_id = ?', [namaAsrama, kamar.kamar_id]);
      }
    }

    console.log(`Berhasil mengelompokkan kamar ke dalam ${asramaGroups.size} asrama.`);
    
    // 2. Buat akun untuk setiap asrama
    const defaultPassword = await bcrypt.hash('123456', 10);

    for (let namaAsrama of asramaGroups) {
      const username = namaAsrama.toLowerCase().replace(/\s+/g, '_'); // e.g., 'asrama_a'
      
      // Cek apakah username sudah ada
      const [existingUsers] = await connection.execute('SELECT id FROM users WHERE username = ?', [username]);
      
      if (existingUsers.length === 0) {
        // Dapatkan max ID untuk manual insert jika tidak auto_increment
        const [maxIdResult] = await connection.execute('SELECT MAX(id) as max_id FROM users');
        const nextId = (maxIdResult[0].max_id || 0) + 1;
        
        await connection.execute(
          `INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`,
          [nextId, username, defaultPassword, 'pengurus_asrama']
        );
        console.log(`✅ Akun dibuat: Username: ${username} | Password: 123456`);
      } else {
        console.log(`⚠️ Akun ${username} sudah ada, dilewati.`);
      }
    }

  } catch (err) {
    console.error("Gagal menjalankan script:", err.message);
  }

  await connection.end();
}

main();
