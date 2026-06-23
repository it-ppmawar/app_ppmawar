const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ppmawaro_absensi_ppma'
  });

  const [users] = await conn.execute('DESCRIBE users');
  console.log('USERS TABLE:');
  console.table(users);

  const [murid] = await conn.execute('DESCRIBE murid');
  console.log('\nMURID TABLE:');
  console.table(murid);

  const [guru] = await conn.execute('DESCRIBE guru');
  console.log('\nGURU TABLE:');
  console.table(guru);

  await conn.end();
}

main().catch(console.error);
