const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'ppmawaro_absensi_ppma'
  });
  
  try {
    await conn.query("ALTER TABLE users MODIFY COLUMN role enum('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama') NOT NULL;");
    await conn.query("ALTER TABLE users ADD COLUMN kamar_id int(11) DEFAULT NULL;");
    console.log('Success altering users table');
  } catch(e) {
    if(e.code === 'ER_DUP_FIELDNAME') {
       console.log('kamar_id already exists');
    } else {
       console.error(e);
    }
  } finally {
    conn.end();
  }
}

main();
