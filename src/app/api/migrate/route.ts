import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const queries = [
      // 1. Tambah barcode_id di tabel murid
      "ALTER TABLE murid ADD COLUMN IF NOT EXISTS barcode_id VARCHAR(255) DEFAULT NULL UNIQUE;",
      
      // 2. Tambah nama_panggilan di tabel murid
      "ALTER TABLE murid ADD COLUMN IF NOT EXISTS nama_panggilan VARCHAR(50) DEFAULT NULL;",
      
      // 3. Tambah jenis_kelamin di tabel murid
      "ALTER TABLE murid ADD COLUMN IF NOT EXISTS jenis_kelamin enum('Laki-laki','Perempuan') DEFAULT NULL;",
      
      // 4. Tambah nama_asrama di tabel kamar untuk sistem hierarki baru
      "ALTER TABLE kamar ADD COLUMN IF NOT EXISTS nama_asrama VARCHAR(100) DEFAULT NULL;",

      // 5. Update enum role di users untuk pengurus_asrama
      "ALTER TABLE users MODIFY COLUMN role enum('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama') NOT NULL;",

      // 6. Tambah kamar_id di tabel users
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS kamar_id int(11) DEFAULT NULL;",

      // 7. Tambah tabel webauthn_credentials untuk login sidik jari
      `CREATE TABLE IF NOT EXISTS \`webauthn_credentials\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`user_id\` int(11) NOT NULL,
        \`credential_id\` text NOT NULL,
        \`public_key\` text NOT NULL,
        \`counter\` bigint(20) NOT NULL DEFAULT 0,
        \`transports\` varchar(255) DEFAULT NULL,
        \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`fk_webauthn_user\` (\`user_id\`),
        CONSTRAINT \`fk_webauthn_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1;`,

      // 8. Tambah jenis_kelamin di tabel alumni
      "ALTER TABLE alumni ADD COLUMN IF NOT EXISTS jenis_kelamin enum('Laki-laki','Perempuan') DEFAULT NULL;",

      // 9. Pindahkan 'A Guru Tugas' & 'A Tahfid Putra' ke 'Asrama A'
      "UPDATE kamar SET nama_asrama = 'Asrama A' WHERE nama_kamar IN ('A Guru Tugas', 'A Tahfid Putra') OR kamar_id IN (13, 14);",

      // 10. Update enum role users untuk mendukung role 'tamu' (mode tamu/guest)
      "ALTER TABLE users MODIFY COLUMN role enum('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama','tamu') NOT NULL;",

      // 11. Buat tabel kurikulum_madin untuk halaman Kurikulum Madin
      `CREATE TABLE IF NOT EXISTS \`kurikulum_madin\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`tingkat\` varchar(50) NOT NULL COMMENT 'Tingkat kelas, misal: Kelas 1, Kelas 2',
        \`mata_pelajaran\` varchar(100) NOT NULL,
        \`kitab\` varchar(150) NOT NULL,
        \`keterangan\` text DEFAULT NULL,
        \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // 12. Update enum role di users untuk pengasuh
      "ALTER TABLE users MODIFY COLUMN role enum('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama','tamu','pengasuh') NOT NULL;",

      // 13. Buat tabel billing untuk info tagihan
      `CREATE TABLE IF NOT EXISTS \`billing\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`nis\` varchar(50) NOT NULL,
        \`nama_santri\` varchar(255) NOT NULL,
        \`asrama\` varchar(100) NOT NULL,
        \`kamar\` varchar(100) NOT NULL,
        \`nama_tagihan\` varchar(150) NOT NULL,
        \`nominal\` decimal(15,2) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'Belum',
        \`periode\` varchar(50) NOT NULL,
        \`source\` varchar(20) NOT NULL DEFAULT 'excel',
        \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`unique_billing\` (\`nis\`, \`nama_tagihan\`, \`periode\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      
      // 14. Tambah kolom kategori di tabel billing
      "ALTER TABLE billing ADD COLUMN IF NOT EXISTS kategori ENUM('pesantren','madrasah') NOT NULL DEFAULT 'pesantren';",

      // 15. Update unique index untuk billing
      "ALTER TABLE billing DROP KEY unique_billing;",
      "ALTER TABLE billing ADD UNIQUE KEY unique_billing (nis, nama_tagihan, periode, kategori);",

      // 16. Update role enum to include 'petugas_sarpras'
      "ALTER TABLE users MODIFY COLUMN role enum('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama','tamu','pengasuh','petugas_sarpras') NOT NULL;",

      // 17. Create tabel inventaris
      `CREATE TABLE IF NOT EXISTS inventaris (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_barang VARCHAR(255) NOT NULL,
        kategori ENUM('alat', 'sarana', 'prasarana', 'lainnya') NOT NULL,
        asrama VARCHAR(100) NOT NULL,
        kamar_id INT DEFAULT NULL,
        jumlah INT NOT NULL DEFAULT 1,
        kondisi ENUM('Baik', 'Rusak Ringan', 'Rusak Berat') NOT NULL DEFAULT 'Baik',
        keterangan TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // 18. Create tabel laporan kerusakan
      `CREATE TABLE IF NOT EXISTS laporan_kerusakan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inventaris_id INT NOT NULL,
        pelapor_id INT NOT NULL,
        petugas_id INT DEFAULT NULL,
        deskripsi_masalah TEXT NOT NULL,
        status ENUM('Dilaporkan', 'Diproses', 'Selesai', 'Dibatalkan') NOT NULL DEFAULT 'Dilaporkan',
        tindakan_perbaikan TEXT DEFAULT NULL,
        tanggal_selesai TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_laporan_inventaris FOREIGN KEY (inventaris_id) REFERENCES inventaris(id) ON DELETE CASCADE,
        CONSTRAINT fk_laporan_pelapor FOREIGN KEY (pelapor_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_laporan_petugas FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // 19. Update users role enum to support all roles including petugas, petugas_umum
      "ALTER TABLE users MODIFY COLUMN role enum('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama','tamu','pengasuh','petugas_sarpras','petugas','petugas_umum','petugas_inventaris','petugas_inventaris_umum','petugas_kebersihan','petugas_kebersihan_umum') NOT NULL;",

      // 20. Add is_pengasuh column to users table for double-role guru as caretaker
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pengasuh TINYINT(1) DEFAULT 0;",

      // 21. Create tabel kebersihan
      `CREATE TABLE IF NOT EXISTS kebersihan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_item VARCHAR(255) NOT NULL,
        kategori ENUM('alat_kebersihan', 'tempat_sampah', 'area_pembuangan', 'lainnya') NOT NULL,
        asrama VARCHAR(100) NOT NULL,
        kamar_id INT DEFAULT NULL,
        jumlah INT NOT NULL DEFAULT 1,
        kondisi ENUM('Bersih', 'Kotor Ringan', 'Kotor Berat') NOT NULL DEFAULT 'Bersih',
        keterangan TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // 22. Create tabel laporan kebersihan
      `CREATE TABLE IF NOT EXISTS laporan_kebersihan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kebersihan_id INT NOT NULL,
        pelapor_id INT NOT NULL,
        petugas_id INT DEFAULT NULL,
        deskripsi_masalah TEXT NOT NULL,
        status ENUM('Dilaporkan', 'Diproses', 'Selesai', 'Dibatalkan') NOT NULL DEFAULT 'Dilaporkan',
        tindakan_kebersihan TEXT DEFAULT NULL,
        tanggal_selesai TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_laporan_kebersihan FOREIGN KEY (kebersihan_id) REFERENCES kebersihan(id) ON DELETE CASCADE,
        CONSTRAINT fk_laporan_keb_pelapor FOREIGN KEY (pelapor_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_laporan_keb_petugas FOREIGN KEY (petugas_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      // 23. Konversi tabel-tabel utama ke utf8mb4 agar karakter Arab dapat tersimpan dan terbaca
      "ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE guru CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE murid CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE alumni CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE kamar CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE kelas_madin CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE kelas_quran CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE jadwal_madin CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE jadwal_quran CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE jadwal_kegiatan CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE absensi CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE absensi_quran CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE absensi_kegiatan CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE absensi_guru CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE billing CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "ALTER TABLE webauthn_credentials CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",

      // 24. Konversi database level ke utf8mb4
      "ALTER DATABASE ppmawaro_app_ppma CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    ];

    let results = [];
    for (const query of queries) {
      try {
        await pool.execute(query);
        results.push({ query, status: 'Success' });
      } catch (err: any) {
        // Abaikan error "Duplicate column name" atau "Can't drop key" atau "Duplicate key name"
        if (
          err.code === 'ER_DUP_FIELDNAME' || 
          err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || 
          err.code === 'ER_DUP_KEYNAME' ||
          err.errno === 1091 ||
          err.errno === 1061
        ) {
          results.push({ query, status: 'Already exists/handled' });
        } else {
          throw err;
        }
      }
    }

    // Seed General / Common accounts
    try {
      const bcrypt = await import('bcryptjs');
      const hashedPwd = await bcrypt.hash('mawar123', 10);
      
      const seedUsers = [
        // 1. Akun Pengasuh
        { username: 'pengasuh_a', nama: 'Pengasuh Asrama A', role: 'pengasuh' },
        { username: 'pengasuh_b', nama: 'Pengasuh Asrama B', role: 'pengasuh' },
        { username: 'pengasuh_c', nama: 'Pengasuh Asrama C', role: 'pengasuh' },
        { username: 'pengasuh_d', nama: 'Pengasuh Asrama D', role: 'pengasuh' },
        { username: 'pengasuh_e', nama: 'Pengasuh Asrama E', role: 'pengasuh' },
        { username: 'pengasuh_f', nama: 'Pengasuh Asrama F', role: 'pengasuh' },
        { username: 'pengasuh_tahfid', nama: 'Pengasuh Asrama Tahfid', role: 'pengasuh' },
        // 2. Akun Pengurus Asrama
        { username: 'pengurus_asrama_a', nama: 'Pengurus Asrama A', role: 'pengurus_asrama' },
        { username: 'pengurus_asrama_b', nama: 'Pengurus Asrama B', role: 'pengurus_asrama' },
        { username: 'pengurus_asrama_c', nama: 'Pengurus Asrama C', role: 'pengurus_asrama' },
        { username: 'pengurus_asrama_d', nama: 'Pengurus Asrama D', role: 'pengurus_asrama' },
        { username: 'pengurus_asrama_e', nama: 'Pengurus Asrama E', role: 'pengurus_asrama' },
        { username: 'pengurus_asrama_f', nama: 'Pengurus Asrama F', role: 'pengurus_asrama' },
        { username: 'pengurus_asrama_tahfid', nama: 'Pengurus Asrama Tahfid', role: 'pengurus_asrama' },
        // 3. Akun Petugas Umum
        { username: 'petugas_umum', nama: 'Petugas Umum', role: 'petugas_umum' }
      ];

      let seededCount = 0;
      for (const u of seedUsers) {
        const [exist] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE username = ? LIMIT 1', [u.username]);
        if (exist.length === 0) {
          await pool.execute(
            'INSERT INTO users (username, password, role, nama) VALUES (?, ?, ?, ?)',
            [u.username, hashedPwd, u.role, u.nama]
          );
          seededCount++;
        }
      }
      results.push({ query: 'Seed general accounts', status: `Success (${seededCount} accounts seeded)` });
    } catch (e: any) {
      results.push({ query: 'Seed general accounts', status: `Error: ${e.message}` });
    }

    // 6. Seed nama_asrama if it is null
    try {
      const [kamarList] = await pool.execute('SELECT kamar_id, nama_kamar, nama_asrama FROM kamar');
      let updatedCount = 0;
      for (const kamar of kamarList as any[]) {
        if (!kamar.nama_asrama && kamar.nama_kamar) {
          const prefix = kamar.nama_kamar.charAt(0).toUpperCase();
          let namaAsrama = null;
          if (['A', 'B', 'C', 'D'].includes(prefix)) {
              namaAsrama = `Asrama ${prefix}`;
          } else if (kamar.nama_kamar.toLowerCase().includes('tahfid')) {
              namaAsrama = 'Asrama Tahfid';
          } else {
              namaAsrama = `Asrama ${prefix}`;
          }
          if (namaAsrama) {
             await pool.execute('UPDATE kamar SET nama_asrama = ? WHERE kamar_id = ?', [namaAsrama, kamar.kamar_id]);
             updatedCount++;
          }
        }
      }
      results.push({ query: 'Seed nama_asrama', status: `Success (${updatedCount} updated)` });
    } catch (e: any) {
      results.push({ query: 'Seed nama_asrama', status: `Error: ${e.message}` });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Migrasi Database Berhasil!', 
      details: results 
    });
  } catch (error: any) {
    console.error('Migrate Error:', error);
    return NextResponse.json({ error: 'Gagal melakukan migrasi: ' + error.message }, { status: 500 });
  }
}
