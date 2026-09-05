import pool from '@/lib/db';

let isReady = false;
let pendingPromise: Promise<void> | null = null;

export async function ensureDewanGuruDB(): Promise<void> {
  if (isReady) return;

  // Hindari multiple concurrent executions saat server baru start
  if (pendingPromise) return pendingPromise;

  pendingPromise = (async () => {
    try {
      // 1. Pastikan tabel dewan_guru
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS dewan_guru (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nip VARCHAR(50) DEFAULT NULL,
          nama VARCHAR(255) NOT NULL,
          jenis_kelamin ENUM('L', 'P') NOT NULL DEFAULT 'L',
          homebase VARCHAR(100) NOT NULL DEFAULT 'YPMA',
          no_hp VARCHAR(50) DEFAULT NULL,
          alamat TEXT DEFAULT NULL,
          tempat_tgl_lahir VARCHAR(150) DEFAULT NULL,
          nama_ibu VARCHAR(150) DEFAULT NULL,
          suami_istri VARCHAR(150) DEFAULT NULL,
          pendidikan_terakhir VARCHAR(150) DEFAULT NULL,
          status_kepegawaian VARCHAR(50) DEFAULT NULL,
          qr_token VARCHAR(100) NOT NULL UNIQUE,
          foto VARCHAR(255) DEFAULT NULL,
          aktif TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_homebase (homebase),
          INDEX idx_qr_token (qr_token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Pastikan tabel jadwal_dewan_guru
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS jadwal_dewan_guru (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nama_sesi VARCHAR(150) NOT NULL,
          homebase VARCHAR(100) DEFAULT 'SEMUA',
          hari ENUM('Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu') NOT NULL,
          jam_mulai TIME NOT NULL,
          jam_selesai TIME NOT NULL,
          toleransi_menit INT NOT NULL DEFAULT 15,
          keterangan TEXT DEFAULT NULL,
          aktif TINYINT(1) NOT NULL DEFAULT 1,
          created_by VARCHAR(100) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_jadwal_hari (hari),
          INDEX idx_jadwal_homebase (homebase)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Pastikan tabel absensi_dewan_guru
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS absensi_dewan_guru (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guru_id INT NOT NULL,
          jadwal_id INT DEFAULT NULL,
          tanggal DATE NOT NULL,
          jam_absen TIME DEFAULT NULL,
          status ENUM('Hadir', 'Izin', 'Sakit', 'Alpha') NOT NULL DEFAULT 'Hadir',
          metode ENUM('Manual', 'QR_Scan', 'Mandiri') NOT NULL DEFAULT 'Manual',
          keterangan TEXT DEFAULT NULL,
          dicatat_oleh VARCHAR(100) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_guru_jadwal_tgl (guru_id, jadwal_id, tanggal),
          INDEX idx_absensi_tgl (tanggal),
          INDEX idx_absensi_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. Auto-Seed dewan_guru jika masih 0
      // PERF: JSON di-load secara LAZY hanya jika dibutuhkan (tidak di-bundle di setiap route)
      const [guruCountRow]: any = await pool.execute('SELECT COUNT(*) as cnt FROM dewan_guru');
      const count = guruCountRow?.[0]?.cnt || 0;

      if (count === 0) {
        console.log('[Auto-Seed] Memuat data awal dewan guru...');
        const { default: initialTeachers } = await import('./dewanGuruInitialData.json');

        if (Array.isArray(initialTeachers) && initialTeachers.length > 0) {
          console.log(`[Auto-Seed] Menyemai ${initialTeachers.length} data dewan guru ke database...`);
          // Insert per batch 50 agar aman dari max_allowed_packet
          const chunkSize = 50;
          for (let i = 0; i < initialTeachers.length; i += chunkSize) {
            const chunk = initialTeachers.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, 1)').join(', ');
            const values: any[] = [];
            for (const t of chunk) {
              values.push(t.nama, t.jenis_kelamin, t.homebase, t.no_hp || null, t.qr_token);
            }
            await pool.execute(
              `INSERT IGNORE INTO dewan_guru (nama, jenis_kelamin, homebase, no_hp, qr_token, aktif) VALUES ${placeholders}`,
              values
            );
          }
          console.log(`[Auto-Seed] Berhasil menyemai data dewan guru!`);
        }
      }

      // 5. Auto-Seed default jadwal jika masih 0
      const [jadwalCountRow]: any = await pool.execute('SELECT COUNT(*) as cnt FROM jadwal_dewan_guru');
      const jadwalCount = jadwalCountRow?.[0]?.cnt || 0;

      if (jadwalCount === 0) {
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Sabtu'] as const;
        for (const h of days) {
          await pool.execute(
            `INSERT INTO jadwal_dewan_guru (nama_sesi, homebase, hari, jam_mulai, jam_selesai, toleransi_menit, keterangan, created_by)
             VALUES (?, 'SEMUA', ?, '07:00:00', '13:30:00', 30, 'Jam Kerja & Mengajar Harian', 'System')`,
            [`KBM & Kehadiran Pagi (${h})`, h]
          );
        }
      }

      isReady = true;
    } catch (err: any) {
      console.error('[ensureDewanGuruDB] Error:', err.message);
      // Jangan set isReady true jika gagal agar bisa di-retry pada request berikutnya
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
}
