const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'absensi_ppma' // adjust if necessary
  });

  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM users LIKE 'role'");
    console.log(rows[0].Type);
  } catch (err) {
    console.error(err);
  }
  await connection.end();
}

main();
