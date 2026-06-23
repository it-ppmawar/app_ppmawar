const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppmawaro_absensi_ppma',
  });

  const [tables] = await connection.query('SHOW TABLES');
  console.log('Tables in database:');
  for (const row of tables) {
    const tableName = Object.values(row)[0];
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const hasBarcode = columns.some(col => col.Field.toLowerCase().includes('barcode'));
    const columnsStr = columns.map(col => `${col.Field} (${col.Type})`).join(', ');
    console.log(`- ${tableName} ${hasBarcode ? '★ (has barcode column)' : ''}`);
    console.log(`  Columns: ${columnsStr}`);
  }

  await connection.end();
}

main().catch(console.error);
