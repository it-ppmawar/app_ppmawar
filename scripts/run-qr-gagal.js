const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const jsQR = require('jsqr');
const https = require('https');

const SOURCE_DIR = path.join('D:', 'koding', 'app.ppmawar', 'KARTU EMAAL 2026 2027', 'QR_GAGAL_DIBACA');
const SERVER_URL = 'https://app.ppmawar.or.id/api/sync/kartu-emaal';
const SQL_OUT = path.join('D:', 'koding', 'app.ppmawar', 'scripts', 'qr-gagal-update.sql');

async function decodeQR(imagePath) {
  try {
    const image = await Jimp.read(imagePath);
    const { data, width, height } = image.bitmap;
    let code = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
    if (!code) code = jsQR(data, width, height, { inversionAttempts: 'onlyInvert' });
    if (!code) code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    return code ? code.data : null;
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
  console.log('Folder QR_GAGAL_DIBACA - Total file:', files.length);

  const mappings = [];
  const masihGagal = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const nis = path.basename(filename, path.extname(filename)).trim();
    const imagePath = path.join(SOURCE_DIR, filename);
    const qrToken = await decodeQR(imagePath);
    if (qrToken) {
      mappings.push({ nis, barcode_id: qrToken });
      console.log('[OK] ' + filename + ' -> ' + qrToken.substring(0, 25) + '...');
    } else {
      masihGagal.push(filename);
      console.log('[XX] ' + filename + ' -> GAGAL');
    }
  }

  console.log('\n=== HASIL ===');
  console.log('Berhasil: ' + mappings.length);
  console.log('Gagal: ' + masihGagal.length);
  if (masihGagal.length > 0) {
    console.log('Masih gagal:');
    masihGagal.forEach(f => console.log('  - ' + f));
  }

  if (mappings.length > 0) {
    const sqlLines = mappings.map(function(m) {
      var safe = m.barcode_id.replace(/'/g, "''");
      return "UPDATE murid SET barcode_id = '" + safe + "' WHERE nis = '" + m.nis + "';";
    });
    fs.writeFileSync(SQL_OUT, sqlLines.join('\n'));
    console.log('\nSQL disimpan ke: ' + SQL_OUT);

    console.log('\nMengirim ' + mappings.length + ' mapping ke server...');
    try {
      const result = await postJSON(SERVER_URL, { mappings });
      console.log('Server response:', JSON.stringify(result, null, 2));
    } catch(e) {
      console.log('Gagal kirim ke server: ' + e.message);
      console.log('Silakan import SQL via phpMyAdmin!');
    }
  }
}

main().catch(console.error);
