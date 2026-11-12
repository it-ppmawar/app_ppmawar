import pool from '@/lib/db';

let isUjianDbEnsured = false;

async function addColumn(table: string, column: string, definition: string) {
  try {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } catch (e: any) {
    // Error 1060: Duplicate column name — sudah ada, abaikan
    if (e.errno === 1060 || e.code === 'ER_DUP_FIELDNAME') {
      return;
    }
    // Jika tipe data perlu disesuaikan, jalankan MODIFY
    try {
      await pool.execute(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${definition}`);
    } catch {
      // ignore
    }
  }
}

export async function ensureUjianDB() {
  if (isUjianDbEnsured) return;

  try {
    // 1. Tabel Master Ujian / Kuis CBT
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ujian_madin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT NULL,
        mata_pelajaran VARCHAR(150) NOT NULL,
        kitab VARCHAR(150) NULL,
        kelas_madin_id INT NULL,
        semester VARCHAR(10) NOT NULL DEFAULT '1',
        tahun_ajaran VARCHAR(20) NOT NULL DEFAULT '2025/2026',
        jenis_ujian ENUM('harian', 'uts', 'uas') NOT NULL DEFAULT 'harian',
        durasi_menit INT NOT NULL DEFAULT 45,
        passing_grade DECIMAL(5,2) NOT NULL DEFAULT 70.00,
        acak_soal TINYINT(1) NOT NULL DEFAULT 1,
        acak_opsi TINYINT(1) NOT NULL DEFAULT 1,
        anti_curang TINYINT(1) NOT NULL DEFAULT 1,
        max_pelanggaran INT NOT NULL DEFAULT 3,
        wajib_fullscreen TINYINT(1) NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        quizb_id VARCHAR(50) NULL,
        quizb_embed_url VARCHAR(255) NULL,
        guru_id INT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ujian_kelas (kelas_madin_id, semester, tahun_ajaran),
        INDEX idx_ujian_mapel (mata_pelajaran)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migrasi kolom baru ujian_madin jika tabel sudah ada
    await addColumn('ujian_madin', 'anti_curang', 'TINYINT(1) NOT NULL DEFAULT 1');
    await addColumn('ujian_madin', 'max_pelanggaran', 'INT NOT NULL DEFAULT 3');
    await addColumn('ujian_madin', 'wajib_fullscreen', 'TINYINT(1) NOT NULL DEFAULT 1');
    await addColumn('ujian_madin', 'quizb_id', 'VARCHAR(50) NULL');
    await addColumn('ujian_madin', 'quizb_embed_url', 'VARCHAR(255) NULL');

    // 2. Tabel Soal (Pilihan Ganda & Essay)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ujian_soal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ujian_id INT NOT NULL,
        tipe_soal ENUM('pilihan_ganda', 'essay') NOT NULL DEFAULT 'pilihan_ganda',
        nomor_urut INT NOT NULL DEFAULT 1,
        pertanyaan LONGTEXT NOT NULL,
        gambar VARCHAR(255) NULL,
        opsi_a TEXT NULL,
        opsi_b TEXT NULL,
        opsi_c TEXT NULL,
        opsi_d TEXT NULL,
        opsi_e TEXT NULL,
        kunci_jawaban LONGTEXT NULL,
        rubrik_kata_kunci TEXT NULL,
        bobot_nilai DECIMAL(5,2) NOT NULL DEFAULT 10.00,
        pembahasan TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_soal_ujian (ujian_id),
        INDEX idx_soal_tipe (tipe_soal)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migrasi kolom baru ujian_soal jika tabel sudah ada sebelumnya
    await addColumn('ujian_soal', 'tipe_soal', "ENUM('pilihan_ganda', 'essay') NOT NULL DEFAULT 'pilihan_ganda'");
    await addColumn('ujian_soal', 'rubrik_kata_kunci', 'TEXT NULL');
    await addColumn('ujian_soal', 'bobot_nilai', 'DECIMAL(5,2) NOT NULL DEFAULT 10.00');
    await addColumn('ujian_soal', 'pembahasan', 'TEXT NULL');
    try { await pool.execute('ALTER TABLE `ujian_soal` MODIFY COLUMN `opsi_a` TEXT NULL'); } catch {}
    try { await pool.execute('ALTER TABLE `ujian_soal` MODIFY COLUMN `opsi_b` TEXT NULL'); } catch {}
    try { await pool.execute('ALTER TABLE `ujian_soal` MODIFY COLUMN `opsi_c` TEXT NULL'); } catch {}
    try { await pool.execute('ALTER TABLE `ujian_soal` MODIFY COLUMN `kunci_jawaban` LONGTEXT NULL'); } catch {}

    // 3. Tabel Sesi Pengawas & Token Ujian
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ujian_sesi_pengawas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ujian_id INT NOT NULL,
        token_ujian VARCHAR(20) NOT NULL,
        wajib_token TINYINT(1) NOT NULL DEFAULT 1,
        wajib_geofence TINYINT(1) NOT NULL DEFAULT 1,
        max_radius_meter INT NOT NULL DEFAULT 200,
        lat_target DECIMAL(10,8) NULL,
        lng_target DECIMAL(11,8) NULL,
        status_sesi ENUM('tertutup', 'buka', 'selesai') NOT NULL DEFAULT 'buka',
        pengawas_user_id INT NULL,
        token_expired_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sesi_ujian (ujian_id),
        INDEX idx_sesi_token (token_ujian)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 4. Tabel Hasil Ujian Santri
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ujian_hasil_santri (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ujian_id INT NOT NULL,
        murid_id INT NOT NULL,
        sesi_id INT NULL,
        token_dipakai VARCHAR(20) NULL,
        jawaban_json LONGTEXT NULL,
        total_soal INT NOT NULL DEFAULT 0,
        jumlah_benar INT NOT NULL DEFAULT 0,
        jumlah_salah INT NOT NULL DEFAULT 0,
        nilai_pg DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        nilai_essay DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        skor_akhir DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        status_lulus TINYINT(1) NOT NULL DEFAULT 0,
        status_koreksi ENUM('selesai', 'menunggu_koreksi') NOT NULL DEFAULT 'selesai',
        jumlah_pelanggaran INT NOT NULL DEFAULT 0,
        is_disqualified TINYINT(1) NOT NULL DEFAULT 0,
        log_pelanggaran JSON NULL,
        waktu_mulai DATETIME NULL,
        waktu_selesai DATETIME NULL,
        durasi_detik INT NOT NULL DEFAULT 0,
        lokasi_lat DECIMAL(10,8) NULL,
        lokasi_lng DECIMAL(11,8) NULL,
        jarak_meter INT NULL,
        device_info VARCHAR(255) NULL,
        ip_address VARCHAR(50) NULL,
        is_sync_ke_raport TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_murid_ujian (ujian_id, murid_id),
        INDEX idx_hasil_murid (murid_id),
        INDEX idx_hasil_koreksi (status_koreksi)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migrasi kolom baru ujian_hasil_santri jika tabel sudah ada sebelumnya
    await addColumn('ujian_hasil_santri', 'nilai_pg', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00');
    await addColumn('ujian_hasil_santri', 'nilai_essay', 'DECIMAL(5,2) NOT NULL DEFAULT 0.00');
    await addColumn('ujian_hasil_santri', 'status_koreksi', "ENUM('selesai', 'menunggu_koreksi') NOT NULL DEFAULT 'selesai'");
    await addColumn('ujian_hasil_santri', 'jumlah_pelanggaran', 'INT NOT NULL DEFAULT 0');
    await addColumn('ujian_hasil_santri', 'is_disqualified', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumn('ujian_hasil_santri', 'log_pelanggaran', 'JSON NULL');

    // 5. Tabel Khusus Jawaban & Koreksi Essay (dengan Asisten AI)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ujian_essay_jawaban (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ujian_id INT NOT NULL,
        murid_id INT NOT NULL,
        hasil_id INT NULL,
        soal_id INT NOT NULL,
        jawaban_santri LONGTEXT NULL,
        bobot_maksimal DECIMAL(5,2) NOT NULL DEFAULT 10.00,
        skor_final DECIMAL(5,2) NULL,
        skor_ai DECIMAL(5,2) NULL,
        feedback_ai TEXT NULL,
        kata_kunci_terdeteksi TEXT NULL,
        status_koreksi ENUM('belum', 'dinilai_ai', 'disetujui') NOT NULL DEFAULT 'belum',
        catatan_guru TEXT NULL,
        dikoreksi_oleh INT NULL,
        dikoreksi_pada DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_murid_soal (ujian_id, murid_id, soal_id),
        INDEX idx_ujian_murid (ujian_id, murid_id),
        INDEX idx_soal (soal_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. Tabel Live Proctoring & Pengawasan Real-Time Ruang Ujian
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ujian_live_proctor (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ujian_id INT NOT NULL,
        murid_id INT NOT NULL,
        status_pengerjaan ENUM('sedang_mengerjakan', 'selesai', 'didiskualifikasi') NOT NULL DEFAULT 'sedang_mengerjakan',
        jumlah_terjawab INT NOT NULL DEFAULT 0,
        jumlah_ragu INT NOT NULL DEFAULT 0,
        total_soal INT NOT NULL DEFAULT 0,
        jumlah_pelanggaran INT NOT NULL DEFAULT 0,
        is_disqualified TINYINT(1) NOT NULL DEFAULT 0,
        log_pelanggaran JSON NULL,
        device_info VARCHAR(255) NULL,
        ip_address VARCHAR(50) NULL,
        waktu_masuk DATETIME NOT NULL,
        last_heartbeat DATETIME NOT NULL,
        waktu_selesai DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_live_murid (ujian_id, murid_id),
        INDEX idx_live_exam (ujian_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    isUjianDbEnsured = true;
  } catch (error) {
    console.error('Error ensuring ujian tables:', error);
  }
}
