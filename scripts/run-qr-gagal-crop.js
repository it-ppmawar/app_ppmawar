/**
 * Script khusus crop QR kiri-bawah di atas background HIJAU GELAP
 * QR ada di kira-kira x:0-30%, y:75-100% dari gambar
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const jsQR = require('jsqr');
const https = require('https');

const SOURCE_DIR = path.join('D:', 'koding', 'app.ppmawar', 'KARTU EMAAL 2026 2027', 'QR_GAGAL_DIBACA');
const SERVER_URL = 'https://app.ppmawar.or.id/api/sync/kartu-emaal';
const SQL_OUT = path.join('D:', 'koding', 'app.ppmawar', 'scripts', 'qr-gagal-update.sql');

function tryDecode(imgData, w, h) {
  const modes = ['dontInvert', 'onlyInvert', 'attemptBoth'];
  for (const m of modes) {
    try {
      const code = jsQR(imgData, w, h, { inversionAttempts: m });
      if (code && code.data) return code.data;
    } catch(e) {}
  }
  return null;
}

async function decodeQRFromCard(imagePath) {
  const orig = await Jimp.read(imagePath);
  const W = orig.bitmap.width;
  const H = orig.bitmap.height;

  // QR ada di kiri-bawah, sekitar 30% lebar, 25% tinggi terakhir
  // Tapi ambil sedikit lebih besar untuk jaga-jaga
  const qrRegions = [
    { x: 0,                  y: Math.floor(H * 0.72), w: Math.floor(W * 0.38), h: Math.floor(H * 0.28), label: 'kiri-bawah-utama' },
    { x: 0,                  y: Math.floor(H * 0.70), w: Math.floor(W * 0.42), h: Math.floor(H * 0.30), label: 'kiri-bawah-lebar' },
    { x: 0,                  y: Math.floor(H * 0.65), w: Math.floor(W * 0.45), h: Math.floor(H * 0.35), label: 'kiri-bawah-xl' },
    { x: 0,                  y: Math.floor(H * 0.75), w: Math.floor(W * 0.35), h: Math.floor(H * 0.25), label: 'kiri-bawah-kecil' },
  ];

  for (const region of qrRegions) {
    try {
      // Crop area QR
      const cropped = orig.clone().crop(region.x, region.y, region.w, region.h);

      // Coba berbagai preprocessing
      const variants = [
        cropped.clone().resize(400, Jimp.AUTO).grayscale().normalize(),
        cropped.clone().resize(400, Jimp.AUTO).grayscale().contrast(0.8).normalize(),
        cropped.clone().resize(400, Jimp.AUTO).grayscale().brightness(0.3).contrast(0.8),
        // Khusus QR di atas hijau: tingkatkan brightness lebih agresif
        cropped.clone().resize(500, Jimp.AUTO).grayscale().brightness(0.5).contrast(1.0).normalize(),
        // Threshold: paksa jadi hitam-putih murni
        cropped.clone().resize(400, Jimp.AUTO).grayscale().threshold({ max: 100 }),
        cropped.clone().resize(400, Jimp.AUTO).grayscale().threshold({ max: 150 }),
        cropped.clone().resize(400, Jimp.AUTO).grayscale().threshold({ max: 80 }),
        // Invert dulu (hijau jadi warna terang, QR jadi putih)
        cropped.clone().resize(400, Jimp.AUTO).invert().grayscale().normalize(),
        cropped.clone().resize(400, Jimp.AUTO).invert().grayscale().threshold({ max: 128 }),
      ];

      for (let vi = 0; vi < variants.length; vi++) {
        const v = variants[vi];
        const result = tryDecode(new Uint8ClampedArray(v.bitmap.data), v.bitmap.width, v.bitmap.height);
        if (result) return { token: result, method: region.label + '-v' + vi };
      }
    } catch(e) {}
  }

  return null;
}

async function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({ raw: b }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const files = fs.readdirSync(SOURCE_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  console.log('QR_GAGAL_DIBACA - Total: ' + files.length + ' file');
  console.log('Strategi: crop pojok kiri-bawah (lokasi QR di atas hijau) + 9 preprocessing\n');

  const mappings = [];
  const masihGagal = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const nis = path.basename(filename, path.extname(filename)).trim();
    const imagePath = path.join(SOURCE_DIR, filename);
    process.stdout.write('[' + (i+1) + '/' + files.length + '] ' + filename + '... ');
    try {
      const decoded = await decodeQRFromCard(imagePath);
      if (decoded) {
        mappings.push({ nis, barcode_id: decoded.token });
        console.log('OK [' + decoded.method + '] -> ' + decoded.token.substring(0, 30) + '...');
      } else {
        masihGagal.push(filename);
        console.log('GAGAL');
      }
    } catch(e) {
      masihGagal.push(filename);
      console.log('ERROR: ' + e.message);
    }
  }

  console.log('\n=== HASIL AKHIR ===');
  console.log('Berhasil: ' + mappings.length + ' dari ' + files.length);
  console.log('Masih gagal: ' + masihGagal.length);
  if (masihGagal.length > 0) {
    console.log('File masih gagal:');
    masihGagal.forEach(function(f) { console.log('  - ' + f); });
  }

  if (mappings.length > 0) {
    var sqlLines = mappings.map(function(m) {
      var safe = m.barcode_id.replace(/'/g, "''");
      return "UPDATE murid SET barcode_id = '" + safe + "' WHERE nis = '" + m.nis + "';";
    });
    fs.writeFileSync(SQL_OUT, sqlLines.join('\n'));
    console.log('\nSQL disimpan: ' + SQL_OUT);

    console.log('\nMengirim ke server...');
    try {
      const result = await postJSON(SERVER_URL, { mappings });
      console.log('Response:', JSON.stringify(result, null, 2));
    } catch(e) {
      console.log('Gagal kirim: ' + e.message);
      console.log('Import SQL via phpMyAdmin: ' + SQL_OUT);
    }
  }
}

main().catch(console.error);
