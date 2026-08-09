const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');

// Mapping: NIS → kelas_madin_id target berdasarkan jadwal madin
// Kelas di DB:
//   3  = 2 WUSTHO (A) PUTRA
//   30 = 3 ULA (A) PUTRI
//   32 = 3 ULA (C) PUTRI
//   21 = 3 WUSTHO (A) PUTRI
//   27 = 2 ULA (A) PUTRI
//   29 = 2 ULA (C) PUTRI
//   18 = 2 WUSTHO (A) PUTRI

const updates = [
  { nis: '2025070280', nama_db: 'M. MARCEL AULIA WICAKSANA',       kelas_target: '2 WUSTHO (A) PUTRA', kelas_id: 3  },
  { nis: '2024070726', nama_db: 'NAILATUN NUR LAILATUL QUDSIYAH',  kelas_target: '3 ULA (A) PUTRI',    kelas_id: 30 },
  { nis: '2024070523', nama_db: 'NATASYA ANGELINA AMANDA FERDIANA',kelas_target: '3 ULA (C) PUTRI',    kelas_id: 32 },
  { nis: '2024070152', nama_db: 'BALQIS NAYSILLA SABILAH',         kelas_target: '3 WUSTHO (A) PUTRI', kelas_id: 21 },
  { nis: '2025070593', nama_db: 'SHOFIE AULIA AFIQAH MARSAID',     kelas_target: '2 ULA (A) PUTRI',    kelas_id: 27 },
  { nis: '2025070514', nama_db: 'DAFINAH ALISHA BATRISYA HARIANTO',kelas_target: '2 ULA (A) PUTRI',    kelas_id: 27 },
  { nis: '2025070598', nama_db: 'ANISA RETNO LULUK NUR MANGGALI',  kelas_target: '2 ULA (C) PUTRI',    kelas_id: 29 },
  { nis: '2025070411', nama_db: 'AURA HANNA ZILFAH DLOFWATUL `AISY', kelas_target: '2 WUSTHO (A) PUTRI', kelas_id: 18 },
];

async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  console.log('=== UPDATE KELAS MADIN - 8 SANTRI ===\n');

  for (const u of updates) {
    // Cek kelas saat ini
    const [rows] = await conn.execute(
      'SELECT m.murid_id, m.nama, m.nis, m.kelas_madin_id, km.nama_kelas FROM murid m LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id WHERE m.nis = ?',
      [u.nis]
    );

    if (rows.length === 0) {
      console.log(`❌ [NIS ${u.nis}] ${u.nama_db} => TIDAK DITEMUKAN DI DB`);
      continue;
    }

    const r = rows[0];
    if (r.kelas_madin_id === u.kelas_id) {
      console.log(`✅ [NIS ${u.nis}] ${r.nama} => Kelas sudah sesuai: ${r.nama_kelas}`);
      continue;
    }

    // Lakukan update
    await conn.execute(
      'UPDATE murid SET kelas_madin_id = ?, updated_at = NOW() WHERE nis = ?',
      [u.kelas_id, u.nis]
    );

    console.log(`🔄 [NIS ${u.nis}] ${r.nama}`);
    console.log(`   Kelas lama: ${r.nama_kelas || '(NULL)'} → Kelas baru: ${u.kelas_target}`);
  }

  console.log('\n✅ Selesai! Semua update kelas madin berhasil diterapkan.');
  await conn.end();
}

run().catch(e => console.error('Error:', e.message));
