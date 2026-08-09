/**
 * Script: Decode QR dari setiap Kartu eMaal 2026/2027
 * Membaca gambar kartu, decode QR code → update barcode_id di DB server via API
 * 
 * Jalankan: node scripts/decode-pair-kartu-emaal.js
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const jsQR = require('jsqr');
const https = require('https');
const http = require('http');

const SOURCE_DIR = path.join(__dirname, '..', 'KARTU EMAAL 2026 2027');
const SERVER_URL = 'https://app.ppmawar.or.id/api/sync/kartu-emaal';

// Baca env untuk cookie/token jika diperlukan
let env = {};
if (fs.existsSync(path.join(__dirname, '..', '.env.local'))) {
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8').split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  });
}

async function decodeQR(imagePath) {
  try {
    const image = await Jimp.read(imagePath);
    const { data, width, height } = image.bitmap;
    const code = jsQR(data, width, height, {
      inversionAttempts: 'dontInvert',
    });
    if (!code) {
      // Coba dengan inversion
      const code2 = jsQR(data, width, height, { inversionAttempts: 'onlyInvert' });
      return code2 ? code2.data : null;
    }
    return code.data;
  } catch (e) {
    return null;
  }
}

async function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
    };
    const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('❌ Folder kartu tidak ditemukan:', SOURCE_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  console.log(`📁 Ditemukan ${files.length} file kartu di folder.`);

  const mappings = [];
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const nis = path.basename(filename, path.extname(filename)).trim();
    const imagePath = path.join(SOURCE_DIR, filename);

    process.stdout.write(`\r[${i + 1}/${files.length}] Memproses ${filename}...`);

    const qrToken = await decodeQR(imagePath);

    if (qrToken) {
      mappings.push({ nis, barcode_id: qrToken });
    } else {
      console.log(`\n  ⚠️  QR tidak terbaca: ${filename}`);
      failed++;
    }
  }

  console.log(`\n\n========================================`);
  console.log(`✅ QR berhasil dibaca: ${mappings.length}`);
  console.log(`❌ QR gagal dibaca: ${failed}`);

  // Simpan mapping ke file JSON sebagai cadangan
  const outFile = path.join(__dirname, 'kartu-emaal-mapping.json');
  fs.writeFileSync(outFile, JSON.stringify(mappings, null, 2));
  console.log(`💾 Mapping disimpan ke: ${outFile}`);

  // Juga buat SQL UPDATE untuk backup
  const sqlFile = path.join(__dirname, 'kartu-emaal-update.sql');
  const sqlLines = mappings.map(m =>
    `UPDATE murid SET barcode_id = '${m.barcode_id.replace(/'/g, "\\'")}' WHERE nis = '${m.nis}' AND (barcode_id IS NULL OR barcode_id = nis OR barcode_id = '');`
  );
  fs.writeFileSync(sqlFile, sqlLines.join('\n'));
  console.log(`📄 SQL update disimpan ke: ${sqlFile}`);

  // Kirim ke server
  if (mappings.length > 0) {
    console.log(`\n🚀 Mengirim ${mappings.length} mapping ke server...`);
    try {
      const result = await postJSON(SERVER_URL, { mappings });
      console.log('✅ Server response:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('⚠️  Gagal mengirim ke server:', e.message);
      console.log('   → Silakan jalankan SQL di scripts/kartu-emaal-update.sql via phpMyAdmin cPanel!');
    }
  }
}

main().catch(console.error);
