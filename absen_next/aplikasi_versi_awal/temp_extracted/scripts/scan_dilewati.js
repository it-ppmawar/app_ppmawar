const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

const INPUT_DIR = path.join(__dirname, '..', 'kartu_hasil', '3_DILEWATI_NAMA_TIDAK_DITEMUKAN_ATAU_DUPLIKAT');

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'absensi_ppma',
  });

  const files = fs.readdirSync(INPUT_DIR);
  let sqlContent = '-- Perbaikan Pairing dari folder 3_DILEWATI\n';

  for (const file of files) {
    if (!file.match(/\.(jpg|jpeg|png)$/i)) continue;
    const filePath = path.join(INPUT_DIR, file);
    
    // Read barcode
    let qrValue = null;
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const image = await Jimp.read(imageBuffer);
      const qrCode = jsQR(image.bitmap.data, image.bitmap.width, image.bitmap.height);
      if (qrCode) qrValue = qrCode.data.replace(/\x1B\[[0-9;]*m/g, '').trim();
    } catch (e) {
      console.log(`[ERROR] Gagal membaca gambar ${file}`);
      continue;
    }

    if (!qrValue) {
      console.log(`[NO_QR] ${file}`);
      continue;
    }

    let cleanName = file.replace(/\.(jpg|jpeg|png)$/i, '').replace(/[_-\d]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanName.startsWith('copy of ')) cleanName = cleanName.substring(8).trim();

    // Search db
    const [murid] = await connection.execute('SELECT nis, nama FROM murid WHERE nama LIKE ?', [`%${cleanName}%`]);
    const [guru] = await connection.execute('SELECT nip, nama FROM guru WHERE nama LIKE ?', [`%${cleanName}%`]);

    console.log(`\nFile: ${file} => Clean Name: ${cleanName}`);
    console.log(`QR Code: ${qrValue}`);
    
    if (murid.length === 1 && guru.length === 0) {
      console.log(`  -> MATCH MURID: ${murid[0].nis} - ${murid[0].nama}`);
      sqlContent += `UPDATE murid SET barcode_id = '${qrValue}' WHERE nis = '${murid[0].nis}';\n`;
    } else if (guru.length === 1 && murid.length === 0) {
      console.log(`  -> MATCH GURU: ${guru[0].nama}`);
      // escape quote
      let namaEscaped = guru[0].nama.replace(/'/g, "''");
      sqlContent += `UPDATE guru SET barcode_id = '${qrValue}' WHERE nama = '${namaEscaped}';\n`;
    } else if (murid.length === 0 && guru.length === 0) {
      console.log(`  -> NOT FOUND in DB`);
      // Try to split name and find parts
      const parts = cleanName.split(' ');
      if (parts.length > 0) {
        const [fuzzy] = await connection.execute('SELECT nis, nama FROM murid WHERE nama LIKE ? AND nama LIKE ?', [`%${parts[0]}%`, `%${parts[parts.length-1]}%`]);
        if (fuzzy.length === 1) {
             console.log(`  -> FUZZY MATCH MURID: ${fuzzy[0].nis} - ${fuzzy[0].nama}`);
             sqlContent += `UPDATE murid SET barcode_id = '${qrValue}' WHERE nis = '${fuzzy[0].nis}';\n`;
        } else {
             console.log(`  -> FUZZY NOT UNIQUE OR NOT FOUND: ${fuzzy.map(m=>m.nama).join(', ')}`);
        }
      }
    } else {
      console.log(`  -> MULTIPLE MATCHES: Murid(${murid.length}), Guru(${guru.length})`);
    }
  }

  fs.writeFileSync(path.join(__dirname, '..', 'perbaikan_pairing.sql'), sqlContent);
  console.log('\n[DONE] Dibuat file perbaikan_pairing.sql');
  await connection.end();
}

main();
