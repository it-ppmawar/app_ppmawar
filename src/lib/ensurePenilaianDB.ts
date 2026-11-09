import pool from '@/lib/db';

let isEnsured = false;

export async function ensurePenilaianDB() {
  if (isEnsured) return;

  try {
    // 1. Tabel nilai_santri
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS nilai_santri (
        id INT AUTO_INCREMENT PRIMARY KEY,
        murid_id INT NOT NULL,
        kelas_madin_id INT NULL,
        kurikulum_id INT NULL,
        mata_pelajaran VARCHAR(150) NOT NULL,
        kitab VARCHAR(150) NULL,
        semester VARCHAR(10) NOT NULL DEFAULT '1',
        tahun_ajaran VARCHAR(20) NOT NULL DEFAULT '2025/2026',
        nilai_harian DECIMAL(5,2) DEFAULT 0,
        nilai_uts DECIMAL(5,2) DEFAULT 0,
        nilai_uas DECIMAL(5,2) DEFAULT 0,
        nilai_akhir DECIMAL(5,2) DEFAULT 0,
        predikat VARCHAR(5) NULL,
        catatan TEXT NULL,
        guru_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_murid_sem (murid_id, semester, tahun_ajaran),
        UNIQUE KEY uq_murid_mapel_sem (murid_id, mata_pelajaran, semester, tahun_ajaran)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. Tabel raport_catatan (catatan wali kelas, kepribadian, tahfidz)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS raport_catatan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        murid_id INT NOT NULL,
        semester VARCHAR(10) NOT NULL DEFAULT '1',
        tahun_ajaran VARCHAR(20) NOT NULL DEFAULT '2025/2026',
        catatan_wali_kelas TEXT NULL,
        akhlak VARCHAR(50) DEFAULT 'Baik',
        kerajinan VARCHAR(50) DEFAULT 'Baik',
        kebersihan VARCHAR(50) DEFAULT 'Baik',
        tahfidz_hafalan VARCHAR(255) NULL,
        status_kelulusan VARCHAR(50) DEFAULT 'Naik Kelas',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_raport_murid_sem (murid_id, semester, tahun_ajaran)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 3. Tabel quizb_sync_logs (riwayat sinkronisasi & webhook dari QuizB)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS quizb_sync_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quiz_id VARCHAR(100) NULL,
        quiz_title VARCHAR(255) NULL,
        target_field VARCHAR(20) NOT NULL DEFAULT 'harian',
        mata_pelajaran VARCHAR(150) NOT NULL,
        semester VARCHAR(10) NOT NULL DEFAULT '1',
        tahun_ajaran VARCHAR(20) NOT NULL DEFAULT '2025/2026',
        total_received INT DEFAULT 0,
        total_matched INT DEFAULT 0,
        source VARCHAR(50) DEFAULT 'webhook',
        detail_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 4. Tabel quizb_settings (konfigurasi integrasi bridge & api key)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS quizb_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Isi default setting jika belum ada
    await pool.execute(`
      INSERT IGNORE INTO quizb_settings (setting_key, setting_value)
      VALUES 
        ('bridge_url', 'https://quizb.my.id/quizb_bridge.php'),
        ('secret_key', 'ppmawar-quizb-2026-secret')
    `);

    isEnsured = true;
  } catch (error) {
    console.error('Error ensuring penilaian tables:', error);
  }
}
