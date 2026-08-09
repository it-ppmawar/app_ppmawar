const fs = require('fs');
const path = require('path');
const https = require('https');

const mappings = JSON.parse(fs.readFileSync(path.join(__dirname, 'kartu-emaal-mapping.json'), 'utf8'));

function postMappings() {
  return new Promise((resolve) => {
    console.log(`🚀 Sending ${mappings.length} mappings to /api/sync/kartu-emaal ...`);
    const data = JSON.stringify({ mappings });
    const req = https.request('https://app.ppmawar.or.id/api/sync/kartu-emaal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('RESPONSE:', body);
        resolve(body);
      });
    });
    req.on('error', e => {
      console.error('Error:', e.message);
      resolve(null);
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  let attempt = 0;
  while (attempt < 20) {
    attempt++;
    console.log(`\n--- Percobaan #${attempt} ---`);
    const resp = await postMappings();
    if (resp && resp.includes('"santri_terpairing":3') || (resp && !resp.includes('"santri_terpairing":0') && resp.includes('"success":true'))) {
      console.log('🎉 SUCCESS! SANTRI TERPAIRING DI DATABASE SERVER!');
      break;
    }
    await new Promise(r => setTimeout(r, 8000));
  }
}

main().catch(console.error);
