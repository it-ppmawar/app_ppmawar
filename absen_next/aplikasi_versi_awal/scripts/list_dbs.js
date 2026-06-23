const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
  });

  const [dbs] = await connection.query('SHOW DATABASES');
  console.log('Databases in MySQL:', dbs.map(d => Object.values(d)[0]));
  await connection.end();
}

main().catch(console.error);
