const fs = require('fs');
const path = require('path');
const https = require('https');

const mappingPath = path.join(__dirname, 'kartu-emaal-mapping.json');
const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

function sendMappings() {
  return new Promise((resolve) => {
    console.log(`🚀 Mengirim ${mappings.length} mapping ke https://app.ppmawar.or.id/api/sync/kartu-emaal ...`);
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
  let attempts = 0;
  while (attempts < 30) {
    attempts++;
    await new Promise(r => setTimeout(r, 6000));
    
    const version = await new Promise(resolve => {
      https.get('https://app.ppmawar.or.id/version.txt', res => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(b.trim().split('\n')[0] || ''));
      }).on('error', () => resolve(''));
    });

    console.log(`[Percobaan ${attempts}] Current deployed: ${version}`);

    if (version.includes('472bb96a')) {
      console.log('🎉 Deploy commit 472bb96a terdeteksi di server!');
      const res = await sendMappings();
      if (res && res.includes('"success":true')) {
        console.log('✅ PAIRING SELESAI SUCCESSFUL!');
        break;
      }
    }
  }
}

main().catch(console.error);
