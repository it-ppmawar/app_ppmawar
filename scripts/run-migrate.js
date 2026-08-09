const https = require('https');

function triggerMigrate() {
  console.log('🚀 Triggering https://app.ppmawar.or.id/api/migrate-db ...');
  https.get('https://app.ppmawar.or.id/api/migrate-db', res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      console.log('RESPONSE:', body);
    });
  });
}

let checks = 0;
const timer = setInterval(() => {
  checks++;
  https.get('https://app.ppmawar.or.id/version.txt', res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const line = body.trim().split('\n')[0] || '';
      console.log(`[Check ${checks}] Deployed version: ${line}`);
      if (body.includes('4891e941') || body.includes('0e10cc5e')) {
        clearInterval(timer);
        console.log('🎉 Commit migration terdeteksi di server!');
        triggerMigrate();
      } else if (checks >= 12) {
        clearInterval(timer);
        console.log('⏰ Max checks reached. Triggering migrate now...');
        triggerMigrate();
      }
    });
  });
}, 8000);
