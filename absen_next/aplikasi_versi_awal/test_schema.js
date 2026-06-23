const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ppmawaro_absensi_ppma',
    multipleStatements: true
  });
  
  try {
    const [jm] = await pool.execute('SELECT * FROM jadwal_madin LIMIT 2');
    console.log("jadwal_madin:", jm);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
