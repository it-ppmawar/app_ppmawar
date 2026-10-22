/**
 * RESTORASI OTOMATIS DATA ABSENSI DARI BUKTI LAPORAN WA
 * PP. Matholi'ul Anwar - Simo Karanggeneng Lamongan
 * 
 * Tanggal: 27 Agustus 2026 s/d 21 Oktober 2026 (25 Hari Laporan)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv() {
  const env = {};
  for (const f of ['.env.local', '.env']) {
    const full = path.resolve(process.cwd(), f);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!env[key]) env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();

// Konfigurasi koneksi database
const dbConfig = {
  host: env.DB_HOST || '127.0.0.1',
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || 'ppmawar2026!',
  database: env.DB_NAME || 'ppmawaro_absensi_ppma',
  charset: 'utf8mb4',
};

// Daftar 25 hari laporan WA
const LAPORAN_DATA = [
  // 1. KAMIS 27 AGT 2026 (SEMUA KELAS)
  {
    tanggal: '2026-08-27',
    mapel: 'TAQRIB & TAFSIR PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 258 },  // 1 MAK PUTRA
      { kelas_id: 33, jadwal_id: 276 }, // 1 MAK PUTRI
      { kelas_id: 6, jadwal_id: 264 },  // 2 MAK PUTRA
      { kelas_id: 34, jadwal_id: 282 }, // 2 MAK PUTRI
      { kelas_id: 7, jadwal_id: 270 },  // 3 MAK PUTRA
      { kelas_id: 35, jadwal_id: 288 }, // 3 MAK PUTRI
    ],
    sakit: ['HILYATUL FAIRAH', 'SALWA%ALINA', 'SINTYA AYU RAMADHONI', 'HANUM CHARISSA', 'QHOIYIMATUL'],
    izin: [],
    alpha: [
      'JAILANI', 'FIROS MUSADDAD', 'APRIANSYAH', 'JEFFRY', 'AQIL AL MURTADLA',
      'DZAKIYAH TALITA', 'TABRIZ NIHAYAH', 'INTAN PUTRI CAHYANI', 'ZHAFIRAH AFRAH',
      'NI%MATUL JANNAH', 'NURUL AZMY', 'PUTRI NOVIANA', 'RARA CINDRA', 'REVANI PUTRI',
      'NANDHA RISTASARI', 'VELANI MAKHSUFI', 'VIYA DIWANI', 'NUR FAJAR ROMADHONI',
      'FATIKHUL', 'SAFIUL REZA', 'HIDAYATULLAH', 'NASHIH AMIN', 'WILDAN ARFIAN',
      'FATHIMAH ANNAJWA', 'FLORETA NAFISHA', 'MARCELIA CRENATA', 'OKTARISA DINI',
      'FAIZATUN NISA', 'SA%ADAH ALFIYANAH', 'AMINAH AZ-ZAHRAH', 'NISAUL MAGHFIROH',
      'SILVY AYU WULANDARI', 'SITI MAGFIROH'
    ]
  },

  // 2. SENIN 31 AGT 2026
  {
    tanggal: '2026-08-31',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 255 },
      { kelas_id: 33, jadwal_id: 273 }
    ],
    sakit: [],
    izin: [],
    alpha: ['NOLALINKA', 'SIELVA']
  },

  // 3. SELASA 1 SEP 2026
  {
    tanggal: '2026-09-01',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 256 },
      { kelas_id: 33, jadwal_id: 274 }
    ],
    sakit: [],
    izin: ['NIDZOM', 'AIDIL', 'FITRO'],
    alpha: ['FARIHATUL']
  },

  // 4. SENIN 21 SEP 2026
  {
    tanggal: '2026-09-21',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 255 },
      { kelas_id: 33, jadwal_id: 273 }
    ],
    sakit: [],
    izin: [],
    alpha: ['AIDIL', 'FITRO', 'GHILMAN', 'NOLALINKA', 'FARIHATUL', 'SIELVA']
  },

  // 5. SELASA 22 SEP 2026
  {
    tanggal: '2026-09-22',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 256 },
      { kelas_id: 33, jadwal_id: 274 }
    ],
    sakit: ['RACHEL', 'IMAMATUL'],
    izin: [],
    alpha: [
      'AIDIL', 'FITRO', 'MARTHA', 'TSABITAH', 'DWI CAHYANI', 'QURROTA',
      'KHARISMA', 'KIRANA', 'NOLALINKA', 'FARIHATUL', 'SIELVA'
    ]
  },

  // 6. SABTU 26 SEP 2026
  {
    tanggal: '2026-09-26',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 253 },
      { kelas_id: 33, jadwal_id: 271 }
    ],
    sakit: ['FADHIL%ELFAJRI'],
    izin: ['GHILMAN', 'NOLALINKA', 'SIELVA'],
    alpha: ['DEVA%RAMADANI', 'KIRANA']
  },

  // 7. AHAD 27 SEP 2026
  {
    tanggal: '2026-09-27',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 254 },
      { kelas_id: 33, jadwal_id: 272 }
    ],
    sakit: ['FADHIL%ELFAJRI'],
    izin: [],
    alpha: ['NIDZOM', 'AULIYA VITA', 'DEVA%RAMADANI', 'GEA', 'NOLALINKA', 'SIELVA', 'NAYLA', 'BILLAH']
  },

  // 8. SENIN 28 SEP 2026
  {
    tanggal: '2026-09-28',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 255 },
      { kelas_id: 33, jadwal_id: 273 }
    ],
    sakit: ['FADHIL%ELFAJRI'],
    izin: [],
    alpha: [
      'ULIL', 'NIDZOM', 'ANFAL', 'AIDIL', 'FITRO', 'SUAIDY',
      'DEVA%RAMADANI', 'MARTHA', 'TSABITAH', 'FARIHATUL'
    ]
  },

  // 9. SELASA 29 SEP 2026
  {
    tanggal: '2026-09-29',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 256 },
      { kelas_id: 33, jadwal_id: 274 }
    ],
    sakit: [],
    izin: [],
    alpha: ['AIDIL', 'FITRO', 'DEVA%RAMADANI', 'GEA', 'KHARISMA', 'NOLALINKA', 'SIELVA', 'NAYLA', 'BILLAH']
  },

  // 10. RABU 30 SEP 2026
  {
    tanggal: '2026-09-30',
    mapel: 'TAFSIR PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 257 },
      { kelas_id: 33, jadwal_id: 275 }
    ],
    sakit: [],
    izin: [],
    alpha: ['SUAIDY', 'DEVA%RAMADANI', 'KHARISMA', 'KIRANA', 'SIELVA']
  },

  // 11. KAMIS 1 OKT 2026 (SEMUA KELAS)
  {
    tanggal: '2026-10-01',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 258 },
      { kelas_id: 33, jadwal_id: 276 },
      { kelas_id: 6, jadwal_id: 264 },
      { kelas_id: 34, jadwal_id: 282 },
      { kelas_id: 7, jadwal_id: 270 },
      { kelas_id: 35, jadwal_id: 288 },
    ],
    sakit: ['KHARISMA', 'ALIFATUZZAHRA'],
    izin: [],
    alpha: [
      'ABELIA', 'DEVA%RAMADANI', 'MARTHA', 'TSABITAH', 'NOLALINKA', 'FARIHATUL', 'SIELVA', 'RACHEL',
      'MUIZ SALAM', 'AZRUL ARIF', 'AZMUL ARIF', 'FIROS MUSADDAD', 'RAFI MAULANA', 'CITRA', 'DZAKIYAH TALITA',
      'HILYATUL', 'TABRIZ NIHAYAH', 'INTAN PUTRI CAHYANI', 'ZAM-ZAMI', 'ZHAFIRAH AFRAH', 'KHOSIATUL',
      'NI%MATUL JANNAH', 'NURUL AZMY', 'RARA CINDRA', 'ALINA ROSYADA', 'NANDHA RISTASARI',
      'SINTYA AYU RAMADHONI', 'VELANI MAKHSUFI', 'VIYA DIWANI', 'NUR FAJAR ROMADHONI', 'FATIKHUL',
      'SAFIUL REZA', 'NASHIH AMIN', 'WILDAN ARFIAN', 'HIMMATUSSALAFIYA', 'ZAIDATUL RAHMA',
      'ISTIMAROH', 'HIDAYATUS MUAWIYAH', 'HANUM CHARISSA', 'MARCELIA CRENATA', 'OKTARISA DINI',
      'FAIZATUN NISA', 'SA%ADAH ALFIYANAH', 'AMINAH AZ-ZAHRAH', 'NINDY AULIA', 'NISAUL MAGHFIROH',
      'QHOIYIMATUL', 'KAMALAT AZIZAH', 'WULANDARI', 'SITI MAGFIROH'
    ]
  },

  // 12. SABTU 3 OKT 2026
  {
    tanggal: '2026-10-03',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 253 },
      { kelas_id: 33, jadwal_id: 271 }
    ],
    sakit: [],
    izin: [],
    alpha: ['NIDZOM', 'AIDIL', 'FITRO', 'SUAIDY', 'MARTHA', 'TSABITAH', 'NOLALINKA', 'FARIHATUL', 'SIELVA']
  },

  // 13. AHAD 4 OKT 2026
  {
    tanggal: '2026-10-04',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 254 },
      { kelas_id: 33, jadwal_id: 272 }
    ],
    sakit: ['DEVA%RAMADANI', 'FARIHATUL'],
    izin: [],
    alpha: ['KIRANA', 'NOLALINKA', 'SIELVA', 'RADIFA']
  },

  // 14. SENIN 5 OKT 2026
  {
    tanggal: '2026-10-05',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 255 },
      { kelas_id: 33, jadwal_id: 273 }
    ],
    sakit: ['AIDIL', 'FITRO'],
    izin: [],
    alpha: ['SURYA PANCA', 'KIRANA', 'NOLALINKA', 'SIELVA', 'NAYLA', 'BILLAH']
  },

  // 15. SELASA 6 OKT 2026
  {
    tanggal: '2026-10-06',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 256 },
      { kelas_id: 33, jadwal_id: 274 }
    ],
    sakit: ['AIDIL', 'FITRO', 'SURYA PANCA'],
    izin: [],
    alpha: ['ULIL', 'NIDZOM', 'WILDAN', 'SUAIDY', 'MARTHA', 'TSABITAH', 'NOLALINKA', 'FARIHATUL', 'SIELVA']
  },

  // 16. RABU 7 OKT 2026
  {
    tanggal: '2026-10-07',
    mapel: 'TAFSIR PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 257 },
      { kelas_id: 33, jadwal_id: 275 }
    ],
    sakit: [],
    izin: [],
    alpha: ['AIDIL', 'FITRO', 'NOLALINKA', 'FARIHATUL', 'SIELVA', 'RADIFA', 'NAYLA', 'BILLAH']
  },

  // 17. AHAD 11 OKT 2026
  {
    tanggal: '2026-10-11',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 254 },
      { kelas_id: 33, jadwal_id: 272 }
    ],
    sakit: [],
    izin: ['SIELVA', 'RACHEL', 'IMAMATUL'],
    alpha: ['NIDZOM', 'AIDIL', 'FITRO', 'SUAIDY', 'GHILMAN']
  },

  // 18. SENIN 12 OKT 2026
  {
    tanggal: '2026-10-12',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 255 },
      { kelas_id: 33, jadwal_id: 273 }
    ],
    sakit: [],
    izin: [],
    alpha: ['AIDIL', 'FITRO', 'NOLALINKA', 'SIELVA']
  },

  // 19. SELASA 13 OKT 2026
  {
    tanggal: '2026-10-13',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 256 },
      { kelas_id: 33, jadwal_id: 274 }
    ],
    sakit: ['AIDIL', 'FITRO', 'KIRANA'],
    izin: [],
    alpha: ['DEVA%RAMADANI', 'QURROTA', 'KHARISMA', 'NOLALINKA', 'SIELVA', 'RASYADA', 'NAYLA', 'BILLAH']
  },

  // 20. RABU 14 OKT 2026
  {
    tanggal: '2026-10-14',
    mapel: 'TAFSIR PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 257 },
      { kelas_id: 33, jadwal_id: 275 }
    ],
    sakit: ['NIDZOM', 'KIRANA'],
    izin: ['DEVA%RAMADANI'],
    alpha: ['AIDIL', 'FITRO', 'MARTHA', 'TSABITAH', 'FARIHATUL', 'SIELVA']
  },

  // 21. SABTU 17 OKT 2026
  {
    tanggal: '2026-10-17',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 253 },
      { kelas_id: 33, jadwal_id: 271 }
    ],
    sakit: [],
    izin: ['NAYLA', 'BILLAH'],
    alpha: ['ANFAL', 'WILDAN', 'AIDIL', 'FITRO', 'SURYA PANCA', 'DEVA%RAMADANI', 'KIRANA', 'NOLALINKA', 'SIELVA']
  },

  // 22. AHAD 18 OKT 2026
  {
    tanggal: '2026-10-18',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 254 },
      { kelas_id: 33, jadwal_id: 272 }
    ],
    sakit: ['WILDAN', 'SURYA PANCA'],
    izin: ['NOLALINKA', 'SIELVA', 'NAYLA', 'BILLAH'],
    alpha: ['NIDZOM', 'AIDIL', 'FITRO', 'SUAIDY', 'DEVA%RAMADANI']
  },

  // 23. SENIN 19 OKT 2026
  {
    tanggal: '2026-10-19',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 255 },
      { kelas_id: 33, jadwal_id: 273 }
    ],
    sakit: ['SURYA PANCA', 'NAYLA', 'BILLAH'],
    izin: [],
    alpha: [
      'NIDZOM', 'WILDAN', 'AIDIL', 'FITRO', 'DEVA%RAMADANI',
      'MARTHA', 'TSABITAH', 'KIRANA', 'NOLALINKA', 'FARIHATUL', 'SIELVA'
    ]
  },

  // 24. SELASA 20 OKT 2026
  {
    tanggal: '2026-10-20',
    mapel: 'TAQRIB PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 256 },
      { kelas_id: 33, jadwal_id: 274 }
    ],
    sakit: ['NAYLA', 'BILLAH'],
    izin: ['NIDZOM', 'SURYA PANCA', 'NOLALINKA', 'SIELVA'],
    alpha: ['AIDIL', 'FITRO', 'SUAIDY', 'DEVA%RAMADANI', 'MARTHA', 'TSABITAH', 'FARIHATUL']
  },

  // 25. RABU 21 OKT 2026
  {
    tanggal: '2026-10-21',
    mapel: 'TAFSIR PAGI',
    inserts: [
      { kelas_id: 5, jadwal_id: 257 },
      { kelas_id: 33, jadwal_id: 275 }
    ],
    sakit: ['NAYLA', 'BILLAH'],
    izin: [],
    alpha: ['FARIHATUL']
  }
];

// Semua jadwal pagi yang ditargetkan
const TARGET_JADWAL_IDS = [
  253, 254, 255, 256, 257, 258, // 1 MAK PUTRA
  271, 272, 273, 274, 275, 276, // 1 MAK PUTRI
  263, 264,                     // 2 MAK PUTRA
  281, 282,                     // 2 MAK PUTRI
  269, 270,                     // 3 MAK PUTRA
  287, 288                      // 3 MAK PUTRI
];

async function main() {
  console.log('====================================================');
  console.log('🚀 MEMULAI RESTORASI ABSENSI OTOMATIS (25 HARI)');
  console.log('====================================================');
  console.log(`Connecting to: ${dbConfig.host} / ${dbConfig.database}...`);

  const conn = await mysql.createConnection(dbConfig);
  console.log('✅ Terhubung ke database MySQL!\n');

  try {
    await conn.beginTransaction();

    const allDates = LAPORAN_DATA.map(d => d.tanggal);

    // 1. Bersihkan record lama HANYA untuk jadwal pagi pada tanggal-tanggal tersebut
    console.log(`🧹 Membersihkan record lama sesi pagi (${allDates.length} tanggal)...`);
    const deleteSql = `
      DELETE FROM absensi 
      WHERE tanggal IN (${allDates.map(d => `'${d}'`).join(',')})
        AND jadwal_madin_id IN (${TARGET_JADWAL_IDS.join(',')})
    `;
    const [delResult] = await conn.execute(deleteSql);
    console.log(`   Dihapus: ${delResult.affectedRows} baris lama yang duplikat/salah.`);

    // 2. Loop setiap hari dan lakukan insert rapi + update status
    for (const lap of LAPORAN_DATA) {
      console.log(`\n📅 Memproses: ${lap.tanggal} (${lap.mapel})...`);

      // Insert untuk masing-masing kelas
      for (const ins of lap.inserts) {
        const insertSql = `
          INSERT INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan)
          SELECT ?, m.murid_id, ?, 'Hadir', ''
          FROM murid m
          WHERE (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?)
        `;
        const [res] = await conn.execute(insertSql, [ins.jadwal_id, lap.tanggal, ins.kelas_id, ins.kelas_id]);
        // console.log(`   + Kelas ${ins.kelas_id} (jadwal ${ins.jadwal_id}): ${res.affectedRows} santri`);
      }

      // Update Sakit
      if (lap.sakit.length > 0) {
        const likeClauses = lap.sakit.map(s => `m.nama LIKE '%${s}%'`).join(' OR ');
        const updateSql = `
          UPDATE absensi a JOIN murid m ON a.murid_id = m.murid_id
          SET a.status = 'Sakit'
          WHERE a.tanggal = ? AND a.jadwal_madin_id IN (${TARGET_JADWAL_IDS.join(',')})
            AND (${likeClauses})
        `;
        const [res] = await conn.execute(updateSql, [lap.tanggal]);
        console.log(`   🩹 Sakit: ${res.affectedRows} santri di-update`);
      }

      // Update Izin
      if (lap.izin.length > 0) {
        const likeClauses = lap.izin.map(s => `m.nama LIKE '%${s}%'`).join(' OR ');
        const updateSql = `
          UPDATE absensi a JOIN murid m ON a.murid_id = m.murid_id
          SET a.status = 'Izin'
          WHERE a.tanggal = ? AND a.jadwal_madin_id IN (${TARGET_JADWAL_IDS.join(',')})
            AND (${likeClauses})
        `;
        const [res] = await conn.execute(updateSql, [lap.tanggal]);
        console.log(`   ✉️  Izin: ${res.affectedRows} santri di-update`);
      }

      // Update Alpha
      if (lap.alpha.length > 0) {
        const likeClauses = lap.alpha.map(s => `m.nama LIKE '%${s}%'`).join(' OR ');
        const updateSql = `
          UPDATE absensi a JOIN murid m ON a.murid_id = m.murid_id
          SET a.status = 'Alpha'
          WHERE a.tanggal = ? AND a.jadwal_madin_id IN (${TARGET_JADWAL_IDS.join(',')})
            AND (${likeClauses})
        `;
        const [res] = await conn.execute(updateSql, [lap.tanggal]);
        console.log(`   ❌ Alpha: ${res.affectedRows} santri di-update`);
      }
    }

    await conn.commit();
    console.log('\n====================================================');
    console.log('✅ COMMIT SUKSES! Seluruh data berhasil disimpan.');
    console.log('====================================================\n');

    // 3. Verifikasi Hasil
    console.log('📊 HASIL VERIFIKASI AKHIR:\n');
    const [rows] = await conn.execute(`
      SELECT 
        a.tanggal,
        jm.mata_pelajaran,
        COUNT(*) as total_santri,
        SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) as Hadir,
        SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as Izin,
        SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as Sakit,
        SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as Alpha
      FROM absensi a
      JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
      WHERE a.tanggal IN (${allDates.map(d => `'${d}'`).join(',')})
        AND jm.jadwal_id IN (${TARGET_JADWAL_IDS.join(',')})
      GROUP BY a.tanggal, jm.mata_pelajaran
      ORDER BY a.tanggal ASC;
    `);

    console.table(rows);

  } catch (err) {
    await conn.rollback();
    console.error('❌ Terjadi kesalahan, transaksi dibatalkan (ROLLBACK):', err);
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
