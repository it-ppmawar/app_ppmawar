const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

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

// Konfigurasi folder input
const INPUT_DIR = path.join(__dirname, '..', 'kartu_santri');

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`\x1b[31m[ERROR] Folder '${INPUT_DIR}' tidak ditemukan!\x1b[0m`);
    console.log(`Silakan buat folder 'kartu_santri' di dalam project dan letakkan gambar kartu di sana.`);
    process.exit(1);
  }

  console.log(`\x1b[36m[INFO] Menghubungkan ke database...\x1b[0m`);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppmawaro_absensi_ppma',
  });
  console.log(`\x1b[32m[SUCCESS] Terhubung ke database: ${process.env.DB_NAME}\x1b[0m\n`);

  console.log(`\x1b[36m[INFO] Mencari file kartu secara rekursif di '${INPUT_DIR}'...\x1b[0m`);
  const files = getFilesRecursive(INPUT_DIR);
  console.log(`\x1b[32m[SUCCESS] Ditemukan ${files.length} file.\x1b[0m\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      console.log(`\x1b[33m[SKIP] ${path.relative(INPUT_DIR, filePath)} (bukan gambar JPG/PNG)\x1b[0m`);
      skipCount++;
      continue;
    }

    const fileName = path.basename(filePath, ext);
    
    // Bersihkan nama file (hapus angka, simbol aneh di awal/akhir)
    // Contoh: "Ahmad Shofa" -> "ahmad shofa"
    const cleanName = fileName.replace(/[_-\d]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    
    if (!cleanName) {
      console.log(`\x1b[31m[FAIL] Nama file kosong setelah dibersihkan: ${path.basename(filePath)}\x1b[0m`);
      failCount++;
      continue;
    }

    console.log(`\x1b[35m[PROCESS] Memproses: ${path.basename(filePath)} (Nama dibersihkan: "${cleanName}")\x1b[0m`);

    try {
      // 1. Baca gambar menggunakan Jimp
      const imageBuffer = fs.readFileSync(filePath);
      const image = await Jimp.read(imageBuffer);
      
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      const imageData = image.bitmap.data;

      // 2. Decode QR Code
      const qrCode = jsQR(imageData, width, height);

      if (!qrCode) {
        console.log(`  \x1b[31m└─ ❌ QR Code tidak terdeteksi pada gambar.\x1b[0m`);
        failCount++;
        continue;
      }

      const qrValue = qrCode.data.trim();
      console.log(`  \x1b[32m├─ 🔑 QR Code terbaca: "${qrValue}"\x1b[0m`);

      // 3. Cari di database (Murid dulu, baru Guru/Pengurus)
      
      // Cari di murid
      const [muridList] = await connection.execute(
        'SELECT murid_id, nis, nama, barcode_id FROM murid WHERE nama LIKE ?',
        [`%${cleanName}%`]
      );

      // Cari di guru
      const [guruList] = await connection.execute(
        'SELECT guru_id, nama, barcode_id FROM guru WHERE nama LIKE ?',
        [`%${cleanName}%`]
      );

      const totalMatches = muridList.length + guruList.length;

      if (totalMatches === 0) {
        console.log(`  \x1b[31m└─ ❌ Nama "${cleanName}" tidak ditemukan baik di tabel murid maupun guru.\x1b[0m`);
        failCount++;
      } else if (totalMatches > 1) {
        // Jika ada lebih dari satu kecocokan, coba cari exact match
        const exactMurid = muridList.find(m => m.nama.toLowerCase().trim() === cleanName);
        const exactGuru = guruList.find(g => g.nama.toLowerCase().trim() === cleanName);

        if (exactMurid && !exactGuru) {
          await pairMurid(connection, exactMurid, qrValue);
          successCount++;
        } else if (exactGuru && !exactMurid) {
          await pairGuru(connection, exactGuru, qrValue);
          successCount++;
        } else {
          console.log(`  \x1b[33m└─ ⚠️ Ditemukan beberapa hasil mirip (Murid: ${muridList.map(m => m.nama).join(', ')} | Guru: ${guruList.map(g => g.nama).join(', ')}). Lewati untuk keamanan.\x1b[0m`);
          failCount++;
        }
      } else {
        // Hanya ada 1 hasil yang cocok
        if (muridList.length === 1) {
          await pairMurid(connection, muridList[0], qrValue);
          successCount++;
        } else {
          await pairGuru(connection, guruList[0], qrValue);
          successCount++;
        }
      }

    } catch (err) {
      console.error(`  \x1b[31m└─ ❌ Error memproses file: ${err.message}\x1b[0m`);
      failCount++;
    }
    console.log(); // Baris baru
  }

  console.log(`\x1b[36m=== RINGKASAN PROSES ===\x1b[0m`);
  console.log(`\x1b[32m[SUCCESS] Berhasil dipasangkan: ${successCount} orang\x1b[0m`);
  console.log(`\x1b[31m[FAILED]  Gagal/Lewat          : ${failCount} file\x1b[0m`);
  console.log(`\x1b[33m[SKIPPED] Diabaikan (non-img)  : ${skipCount} file\x1b[0m`);
  console.log(`\x1b[36m========================\x1b[0m`);

  await connection.end();
}

async function pairMurid(connection, murid, qrValue) {
  // Cek apakah QR Code ini sudah dipakai orang lain di tabel murid
  const [existingMurid] = await connection.execute(
    'SELECT murid_id, nama FROM murid WHERE barcode_id = ? AND murid_id != ?',
    [qrValue, murid.murid_id]
  );
  // Cek juga di tabel guru
  const [existingGuru] = await connection.execute(
    'SELECT guru_id, nama FROM guru WHERE barcode_id = ?',
    [qrValue]
  );

  if (existingMurid.length > 0) {
    console.log(`  \x1b[33m└─ ⚠️ QR ini sudah dipakai oleh santri lain: "${existingMurid[0].nama}"\x1b[0m`);
    throw new Error(`QR Code konflik dengan murid "${existingMurid[0].nama}"`);
  }
  if (existingGuru.length > 0) {
    console.log(`  \x1b[33m└─ ⚠️ QR ini sudah dipakai oleh guru/pengurus lain: "${existingGuru[0].nama}"\x1b[0m`);
    throw new Error(`QR Code konflik dengan guru "${existingGuru[0].nama}"`);
  }

  // Update ke database
  await connection.execute(
    'UPDATE murid SET barcode_id = ? WHERE murid_id = ?',
    [qrValue, murid.murid_id]
  );
  console.log(`  \x1b[32m└─ 🎉 BERHASIL! Santri [${murid.nis}] ${murid.nama} dipasangkan dengan barcode: ${qrValue}\x1b[0m`);
}

async function pairGuru(connection, guru, qrValue) {
  // Cek apakah QR Code ini sudah dipakai orang lain di tabel murid
  const [existingMurid] = await connection.execute(
    'SELECT murid_id, nama FROM murid WHERE barcode_id = ?',
    [qrValue]
  );
  // Cek juga di tabel guru
  const [existingGuru] = await connection.execute(
    'SELECT guru_id, nama FROM guru WHERE barcode_id = ? AND guru_id != ?',
    [qrValue, guru.guru_id]
  );

  if (existingMurid.length > 0) {
    console.log(`  \x1b[33m└─ ⚠️ QR ini sudah dipakai oleh santri lain: "${existingMurid[0].nama}"\x1b[0m`);
    throw new Error(`QR Code konflik dengan murid "${existingMurid[0].nama}"`);
  }
  if (existingGuru.length > 0) {
    console.log(`  \x1b[33m└─ ⚠️ QR ini sudah dipakai oleh guru/pengurus lain: "${existingGuru[0].nama}"\x1b[0m`);
    throw new Error(`QR Code konflik dengan guru "${existingGuru[0].nama}"`);
  }

  // Update ke database
  await connection.execute(
    'UPDATE guru SET barcode_id = ? WHERE guru_id = ?',
    [qrValue, guru.guru_id]
  );
  console.log(`  \x1b[32m└─ 🎉 BERHASIL! Guru/Pengurus/Sesepuh ${guru.nama} dipasangkan dengan barcode: ${qrValue}\x1b[0m`);
}

function getFilesRecursive(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursive(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

main().catch(err => {
  console.error('\x1b[31mFatal Error:\x1b[0m', err);
});
