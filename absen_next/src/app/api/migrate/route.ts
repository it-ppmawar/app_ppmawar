import { NextResponse } from 'next/server';
import pool from '@/lib/db';

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
      "ALTER TABLE billing ADD UNIQUE KEY unique_billing (nis, nama_tagihan, periode, kategori);"
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
