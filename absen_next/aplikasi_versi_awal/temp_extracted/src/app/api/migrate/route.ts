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
      "ALTER TABLE alumni ADD COLUMN IF NOT EXISTS jenis_kelamin enum('Laki-laki','Perempuan') DEFAULT NULL;"
    ];

    let results = [];
    for (const query of queries) {
      try {
        await pool.execute(query);
        results.push({ query, status: 'Success' });
      } catch (err: any) {
        // Abaikan error "Duplicate column name" (ER_DUP_FIELDNAME)
        if (err.code === 'ER_DUP_FIELDNAME') {
          results.push({ query, status: 'Already exists' });
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
