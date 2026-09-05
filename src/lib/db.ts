import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  // Gunakan 127.0.0.1 bukan 'localhost' untuk menghindari error ETIMEDOUT
  // di Windows karena 'localhost' bisa di-resolve ke IPv6 (::1) sedangkan
  // MySQL/XAMPP hanya listen di IPv4 (127.0.0.1)
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ppmawaro_app_ppma',
  charset: 'utf8mb4',
  waitForConnections: true,
  // PERF: Turunkan dari 10 ke 3 untuk shared hosting (cPanel biasanya limit 5-10 total koneksi)
  connectionLimit: 3,
  queueLimit: 0,
  connectTimeout: 10000,
  // PERF: Lepas koneksi idle setelah 60 detik agar tidak habis limit koneksi hosting
  idleTimeout: 60000,
  // PERF: Aktifkan keep-alive agar koneksi yang ada tidak di-drop server MySQL
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export default pool;
