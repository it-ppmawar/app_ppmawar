import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const results: string[] = [];

  try {
    // 1. Table dewan_guru
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
    results.push('✅ Tabel dewan_guru siap');

    // 2. Table jadwal_dewan_guru
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
    results.push('✅ Tabel jadwal_dewan_guru siap');

    // Default jadwal jika kosong
    const [existingJadwal]: any = await pool.execute('SELECT COUNT(*) as cnt FROM jadwal_dewan_guru');
    if (existingJadwal[0]?.cnt === 0) {
      const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'] as const;
      for (const h of days) {
        if (h !== 'Jumat') {
          await pool.execute(`
            INSERT INTO jadwal_dewan_guru (nama_sesi, homebase, hari, jam_mulai, jam_selesai, toleransi_menit, keterangan, created_by)
            VALUES (?, 'SEMUA', ?, '07:00:00', '13:30:00', 30, 'Jam Kerja & Mengajar Harian', 'System')
          `, [`KBM & Kehadiran Pagi (${h})`, h]);
        }
      }
      results.push('✅ Default jadwal_dewan_guru Senin-Sabtu ditambahkan');
    }

    // 3. Table absensi_dewan_guru
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
        FOREIGN KEY (guru_id) REFERENCES dewan_guru(id) ON DELETE CASCADE,
        FOREIGN KEY (jadwal_id) REFERENCES jadwal_dewan_guru(id) ON DELETE SET NULL,
        INDEX idx_absensi_tgl (tanggal),
        INDEX idx_absensi_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    results.push('✅ Tabel absensi_dewan_guru siap');

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ success: false, error: error.message, results }, { status: 500 });
  }
}
