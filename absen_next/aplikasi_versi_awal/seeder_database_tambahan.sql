-- Tabel Kurikulum Madin
CREATE TABLE IF NOT EXISTS `kurikulum_madin` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tingkat` VARCHAR(50) NOT NULL COMMENT 'Ula, Wustho, MAK, dll',
  `mata_pelajaran` VARCHAR(100) NOT NULL,
  `kitab` TEXT NOT NULL COMMENT 'Detail kitab atau jenjang kitab',
  `keterangan` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- Seed Data Kurikulum
INSERT IGNORE INTO `kurikulum_madin` (`tingkat`, `mata_pelajaran`, `kitab`, `keterangan`) VALUES
('ULA', 'Fiqh', 'Mabadi'' fiqhiyyah jilid 3 => Matan Taqrib', 'Melanjutkan sampai khatamnya kitab sebelumnya'),
('ULA', 'Aqidah', 'Aqidatul awam => Aqidatul Islamiyah => matan tijanud durori', 'Melanjutkan sampai khatamnya kitab sebelumnya'),
('ULA', 'Akhlaq', 'Taysirul Khollaq => akhlaq lil banat j.2', 'Melanjutkan sampai khatamnya kitab sebelumnya'),
('ULA', 'Bahasa Arab', 'Madarij Ta''limul Lughah jilid 2 => madarijuddurus jilid 3', 'Melanjutkan sampai khatamnya kitab sebelumnya'),
('ULA', 'Nahwu', 'Al Miftah lil ''Ulum jilid 1, 2 dst => Matan Jurumiyyah', 'Melanjutkan sampai khatamnya kitab sebelumnya'),
('WUSTHO', 'Fiqh', 'Ghayah wat Taqrib', 'Kitab wajib tingkat Wustho'),
('WUSTHO', 'Aqidah', 'Jawahirul Kalamiyah', 'Kitab wajib tingkat Wustho'),
('WUSTHO', 'Akhlaq', 'Adabul ''Alim wal Muta''allim', 'Kitab wajib tingkat Wustho'),
('WUSTHO', 'Bahasa Arab', 'Al-Arabiyyah lin Nasyi''in', 'Kitab wajib tingkat Wustho'),
('WUSTHO', 'Nahwu', 'Al-Miftah lil ''Ulum', 'Kitab wajib tingkat Wustho');

-- Tabel Alumni (Jika belum ada)
CREATE TABLE IF NOT EXISTS `alumni` (
  `alumni_id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama` VARCHAR(100) NOT NULL,
  `nis` VARCHAR(50) DEFAULT NULL,
  `nik` VARCHAR(50) DEFAULT NULL,
  `no_hp` VARCHAR(20) DEFAULT NULL,
  `alamat` TEXT DEFAULT NULL,
  `tahun_masuk` VARCHAR(10) DEFAULT NULL,
  `tahun_keluar` VARCHAR(10) DEFAULT NULL,
  `status_keluar` VARCHAR(50) DEFAULT 'Lulus',
  `jenis_kelamin` ENUM('L', 'P') DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
