import pool from '@/lib/db';

let isEnsured = false;

export async function ensureKuponMakanDB() {
  if (isEnsured) return;

  try {
    // 1. Tabel riwayat_makan (pencatatan scan kupon makan santri)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS riwayat_makan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        murid_id INT NOT NULL,
        nis VARCHAR(50) NOT NULL,
        nama VARCHAR(255) NOT NULL,
        asrama VARCHAR(100) NULL,
        kamar VARCHAR(100) NULL,
        tanggal DATE NOT NULL,
        sesi VARCHAR(50) NOT NULL,
        waktu_scan TIME NOT NULL,
        status ENUM('berhasil', 'dispensasi', 'ditolak') NOT NULL DEFAULT 'berhasil',
        alasan VARCHAR(255) NULL,
        operator VARCHAR(100) NULL,
        catatan TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_makan_tanggal_sesi (tanggal, sesi),
        INDEX idx_makan_murid_tanggal (murid_id, tanggal, sesi),
        INDEX idx_makan_nis (nis)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Pastikan kolom sesi adalah VARCHAR(50) agar mendukung sahur, buka_puasa, dsb jika sebelumnya ENUM
    try {
      await pool.execute(`ALTER TABLE riwayat_makan MODIFY COLUMN sesi VARCHAR(50) NOT NULL`);
    } catch (_) {}

    // 2. Tabel Master Jadwal Sesi Makan (Dapat dikonfigurasi & diubah sesuai Ramadhan/Reguler 2x/3x)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS jadwal_sesi_makan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kode_sesi VARCHAR(50) UNIQUE NOT NULL,
        nama_sesi VARCHAR(100) NOT NULL,
        jam_mulai TIME NOT NULL,
        jam_selesai TIME NOT NULL,
        is_aktif TINYINT(1) NOT NULL DEFAULT 1,
        urutan INT NOT NULL DEFAULT 1,
        keterangan VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Masukkan sesi default (default pesantren saat ini: 2x makan sehari: Sarapan Pagi 05.30-06.30 & Makan Sore 16.30-17.30)
    const defaultSesiList = [
      { kode: 'pagi', nama: 'Sarapan Pagi', mulai: '05:30:00', selesai: '06:30:00', aktif: 1, urutan: 1, ket: 'Jadwal Reguler Pagi (05.30 - 06.30 WIB)' },
      { kode: 'malam', nama: 'Makan Sore / Malam', mulai: '16:30:00', selesai: '17:30:00', aktif: 1, urutan: 2, ket: 'Jadwal Reguler Sore (16.30 - 17.30 WIB)' },
      { kode: 'siang', nama: 'Makan Siang', mulai: '11:00:00', selesai: '14:30:00', aktif: 0, urutan: 3, ket: 'Nonaktif saat mode 2x makan' },
      { kode: 'sahur', nama: 'Sahur (Ramadhan)', mulai: '02:30:00', selesai: '04:30:00', aktif: 0, urutan: 4, ket: 'Khusus Bulan Ramadhan / Puasa' },
      { kode: 'buka_puasa', nama: 'Buka Puasa (Ramadhan)', mulai: '17:30:00', selesai: '20:00:00', aktif: 0, urutan: 5, ket: 'Khusus Bulan Ramadhan / Puasa' },
    ];

    for (const s of defaultSesiList) {
      try {
        await pool.execute(
          `INSERT INTO jadwal_sesi_makan (kode_sesi, nama_sesi, jam_mulai, jam_selesai, is_aktif, urutan, keterangan)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             jam_mulai = VALUES(jam_mulai),
             jam_selesai = VALUES(jam_selesai),
             keterangan = VALUES(keterangan)`,
          [s.kode, s.nama, s.mulai, s.selesai, s.aktif, s.urutan, s.ket]
        );
      } catch (_) {}
    }

    // 4. Tabel pengaturan kupon makan umum
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS pengaturan_kupon_makan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_pengaturan VARCHAR(100) UNIQUE NOT NULL,
        nilai VARCHAR(255) NOT NULL,
        keterangan VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const defaultSettings = [
      { key: 'mode_uji_coba', val: '1', desc: '1 = Mode Uji Coba Berdampingan (bisa dispensasi cepat), 0 = Normal Ketat' },
      { key: 'preset_aktif', val: 'reguler_2x', desc: 'Preset jadwal: reguler_2x, ramadhan, atau reguler_3x' },
      { key: 'filter_tunggakan_kategori', val: 'pesantren', desc: 'Kategori tagihan yang dicek: pesantren atau semua' }
    ];

    for (const s of defaultSettings) {
      try {
        await pool.execute(
          `INSERT IGNORE INTO pengaturan_kupon_makan (nama_pengaturan, nilai, keterangan) VALUES (?, ?, ?)`,
          [s.key, s.val, s.desc]
        );
      } catch (_) {}
    }

    isEnsured = true;
  } catch (error) {
    console.error('Error ensuring kupon makan tables:', error);
  }
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export async function detectActiveSesiWIB(): Promise<{ activeKode: string; activeNama: string; sessions: any[] }> {
  await ensureKuponMakanDB();

  const [rows] = await pool.query<any[]>(
    `SELECT * FROM jadwal_sesi_makan ORDER BY urutan ASC`
  );

  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  const currentMin = timeToMinutes(timeStr);

  const activeRows = rows.filter(r => r.is_aktif === 1);

  let matched = activeRows.find(r => {
    const startMin = timeToMinutes(r.jam_mulai);
    const endMin = timeToMinutes(r.jam_selesai);
    if (startMin <= endMin) {
      return currentMin >= startMin && currentMin <= endMin;
    } else {
      return currentMin >= startMin || currentMin <= endMin;
    }
  });

  if (!matched && activeRows.length > 0) {
    const upcoming = activeRows.find(r => timeToMinutes(r.jam_mulai) > currentMin);
    matched = upcoming || activeRows[0];
  }

  const activeKode = matched ? matched.kode_sesi : (activeRows[0]?.kode_sesi || 'siang');
  const activeNama = matched ? matched.nama_sesi : (activeRows[0]?.nama_sesi || 'Makan Siang');

  return { activeKode, activeNama, sessions: rows };
}
