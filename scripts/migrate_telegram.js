const mysql = require('mysql2/promise');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

async function migrateTelegram() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppmawaro_app_ppma'
  });

  console.log("Connected to MySQL database. Running Telegram migrations...");

  // 1. Tambah kolom telegram_chat_id & telegram_username ke tabel guru jika belum ada
  try {
    const [guruCols] = await connection.execute("SHOW COLUMNS FROM guru LIKE 'telegram_chat_id'");
    if (guruCols.length === 0) {
      await connection.execute(`
        ALTER TABLE guru 
        ADD COLUMN telegram_chat_id VARCHAR(64) DEFAULT NULL AFTER no_hp,
        ADD COLUMN telegram_username VARCHAR(64) DEFAULT NULL AFTER telegram_chat_id
      `);
      console.log("Added telegram_chat_id & telegram_username to table 'guru'.");
    } else {
      console.log("Columns telegram_chat_id already exist in 'guru'.");
    }
  } catch (e) {
    console.error("Error checking/adding columns to 'guru':", e.message);
  }

  // 2. Tambah kolom telegram_chat_id & telegram_username ke tabel murid jika belum ada
  try {
    const [muridCols] = await connection.execute("SHOW COLUMNS FROM murid LIKE 'telegram_chat_id'");
    if (muridCols.length === 0) {
      await connection.execute(`
        ALTER TABLE murid 
        ADD COLUMN telegram_chat_id VARCHAR(64) DEFAULT NULL,
        ADD COLUMN telegram_username VARCHAR(64) DEFAULT NULL
      `);
      console.log("Added telegram_chat_id & telegram_username to table 'murid'.");
    } else {
      console.log("Columns telegram_chat_id already exist in 'murid'.");
    }
  } catch (e) {
    console.error("Error checking/adding columns to 'murid':", e.message);
  }

  // 3. Tambah kolom telegram_chat_id & telegram_username ke tabel users jika belum ada
  try {
    const [usersCols] = await connection.execute("SHOW COLUMNS FROM users LIKE 'telegram_chat_id'");
    if (usersCols.length === 0) {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN telegram_chat_id VARCHAR(64) DEFAULT NULL,
        ADD COLUMN telegram_username VARCHAR(64) DEFAULT NULL
      `);
      console.log("Added telegram_chat_id & telegram_username to table 'users'.");
    } else {
      console.log("Columns telegram_chat_id already exist in 'users'.");
    }
  } catch (e) {
    console.error("Error checking/adding columns to 'users':", e.message);
  }

  // 4. Inisialisasi default settings Telegram di pengaturan_absensi_otomatis
  const defaultSettings = [
    ['telegram_bot_token', '8260588054:AAEB_71eA2XnRLHiYQV6jsZaiapsYcMd6yE'],
    ['telegram_bot_username', 'ppma_notif_bot'],
    ['telegram_notification_mode', 'both'], // 'telegram_only' | 'wa_only' | 'both'
    ['telegram_kepala_madin_putra_chat_id', ''],
    ['telegram_kepala_madin_putri_chat_id', ''],
    ['telegram_kepala_madin_chat_id', ''],
    ['telegram_auto_reminder_guru', '1'],
    ['telegram_auto_rekap_kepala_madin', '1'],
    ['telegram_auto_notif_wali', '1']
  ];

  for (const [key, val] of defaultSettings) {
    try {
      await connection.execute(
        `INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE nilai = COALESCE(NULLIF(nilai, ''), VALUES(nilai))`,
        [key, val]
      );
    } catch (e) {
      console.error(`Error setting default for ${key}:`, e.message);
    }
  }

  console.log("Default Telegram settings populated successfully.");
  await connection.end();
  console.log("Telegram migration finished successfully!");
}

migrateTelegram().catch(err => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
