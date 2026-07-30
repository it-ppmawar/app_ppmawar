const fs = require('fs');
const mysql = require('mysql2/promise');

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  });
}
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf-8').split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && !env[parts[0].trim()]) env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  });
}

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: env.DB_HOST || 'localhost',
      user: env.DB_USER || 'root',
      password: env.DB_PASSWORD || '',
      database: env.DB_NAME || 'app_ppmawar'
    });

    const [rows] = await conn.execute('SELECT murid_id, nis, nama, barcode_id, kamar_id FROM murid WHERE nis LIKE ? OR nama LIKE ?', ['%2026050007%', '%SANDI ALAMSYAH%']);
    console.log('Result for Sandi Alamsyah:', rows);

    const [sample] = await conn.execute('SELECT murid_id, nis, nama, barcode_id FROM murid ORDER BY murid_id DESC LIMIT 15');
    console.log('Sample recent murid:', sample);

    const [total] = await conn.execute('SELECT COUNT(*) as total_santri, COUNT(barcode_id) as total_paired FROM murid');
    console.log('Stats:', total[0]);

    await conn.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
