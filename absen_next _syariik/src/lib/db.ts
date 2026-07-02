import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  // Gunakan 127.0.0.1 bukan 'localhost' untuk menghindari error ETIMEDOUT
  // di Windows karena 'localhost' bisa di-resolve ke IPv6 (::1) sedangkan
  // MySQL/XAMPP hanya listen di IPv4 (127.0.0.1)
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ppmawaro_absensi_ppma',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000, // timeout 10 detik agar error lebih cepat terdeteksi
});

export default pool;
