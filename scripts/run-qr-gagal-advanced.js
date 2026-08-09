const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const jsQR = require('jsqr');
const https = require('https');

const SOURCE_DIR = path.join('D:', 'koding', 'app.ppmawar', 'KARTU EMAAL 2026 2027', 'QR_GAGAL_DIBACA');
const SERVER_URL = 'https://app.ppmawar.or.id/api/sync/kartu-emaal';
const SQL_OUT = path.join('D:', 'koding', 'app.ppmawar', 'scripts', 'qr-gagal-update.sql');

async function tryDecode(imgData, w, h) {
  const attempts = ['dontInvert', 'onlyInvert', 'attemptBoth'];
  for (const inv of attempts) {
    const code = jsQR(imgData, w, h, { inversionAttempts: inv });
    if (code && code.data) return code.data;
  }
  return null;
}

async function decodeQRAdvanced(imagePath) {
  try {
    const orig = await Jimp.read(imagePath);

    // Attempt 1: Original
    let result = await tryDecode(new Uint8ClampedArray(orig.bitmap.data), orig.bitmap.width, orig.bitmap.height);
    if (result) return { token: result, method: 'original' };

    // Attempt 2: Grayscale + Normalize
    const gs = orig.clone().grayscale().normalize();
    result = await tryDecode(new Uint8ClampedArray(gs.bitmap.data), gs.bitmap.width, gs.bitmap.height);
    if (result) return { token: result, method: 'grayscale+normalize' };

    // Attempt 3: Contrast boost
    const ct = orig.clone().grayscale().contrast(0.5).normalize();
    result = await tryDecode(new Uint8ClampedArray(ct.bitmap.data), ct.bitmap.width, ct.bitmap.height);
    if (result) return { token: result, method: 'contrast' };

    // Attempt 4: Resize larger (800px) - helps if image too small
    const rs = orig.clone().resize(800, Jimp.AUTO).grayscale().normalize();
    result = await tryDecode(new Uint8ClampedArray(rs.bitmap.data), rs.bitmap.width, rs.bitmap.height);
    if (result) return { token: result, method: 'resize800' };

    // Attempt 5: Resize 1200px + contrast
    const rs2 = orig.clone().resize(1200, Jimp.AUTO).grayscale().contrast(0.7).normalize();
    result = await tryDecode(new Uint8ClampedArray(rs2.bitmap.data), rs2.bitmap.width, rs2.bitmap.height);
    if (result) return { token: result, method: 'resize1200+contrast' };

    // Attempt 6: Threshold (binary) - turns image pure black/white
    const thresh = orig.clone().grayscale().threshold({ max: 128 });
    result = await tryDecode(new Uint8ClampedArray(thresh.bitmap.data), thresh.bitmap.width, thresh.bitmap.height);
    if (result) return { token: result, method: 'threshold' };

    // Attempt 7: Invert then threshold
    const inv2 = orig.clone().grayscale().invert().threshold({ max: 128 });
    result = await tryDecode(new Uint8ClampedArray(inv2.bitmap.data), inv2.bitmap.width, inv2.bitmap.height);
    if (result) return { token: result, method: 'invert+threshold' };

    return null;
  } catch(e) { return null; }
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
  console.log('QR_GAGAL_DIBACA - Total:', files.length, 'file');
  console.log('Menggunakan 7 metode decode berbeda per file...\n');

  const mappings = [];
  const masihGagal = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const nis = path.basename(filename, path.extname(filename)).trim();
    const imagePath = path.join(SOURCE_DIR, filename);
    const decoded = await decodeQRAdvanced(imagePath);
    if (decoded) {
      mappings.push({ nis, barcode_id: decoded.token });
      console.log('[OK] ' + filename + ' [' + decoded.method + '] -> ' + decoded.token.substring(0, 30) + '...');
    } else {
      masihGagal.push(filename);
      console.log('[XX] ' + filename + ' -> Semua metode gagal');
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
      console.log('Silakan import SQL via phpMyAdmin!');
    }
  } else {
    console.log('\nSemua file gagal - tidak ada yang dikirim ke server.');
  }
}

main().catch(console.error);
