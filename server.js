const express = require('express');
const next = require('next');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');


// Load environment variables manually for the custom server
try {
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(__dirname);
} catch (e) {
  console.warn('[ENV] loadEnvConfig warning:', e.message);
}

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = express();

  // Middleware (Hanya gunakan jika membuat API custom murni Express)
  // Jangan gunakan express.json() secara global karena akan merusak Next.js API Routes (App Router)

  // --- AUTO-ALPHA GURU & SANTRI (pukul 23:00 WIB) ---
  // Jalankan setiap malam pukul 23:00 untuk mencatat Alpha otomatis bagi jadwal yang sudah lewat
  cron.schedule('0 23 * * *', async () => {
    console.log('[CRON] Memulai Auto-Alpha Guru & Santri otomatis (23:00 WIB)...');

    const mysql = require('mysql2/promise');
    let conn;
    try {
      conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ppmawaro_app_ppma',
        connectTimeout: 10000
      });

      // Ambil semua pengaturan auto-alpha sekaligus
      const [settingRows] = await conn.execute(
        `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis 
         WHERE nama_pengaturan IN ('waktu_tenggang_absensi', 'absensi_otomatis_guru',
         'absensi_otomatis_madin', 'absensi_otomatis_quran', 'absensi_otomatis_kegiatan')`
      );
      const settingsMap = {};
      settingRows.forEach(r => { settingsMap[r.nama_pengaturan] = r.nilai; });

      const waktuTenggangJam = settingsMap['waktu_tenggang_absensi'] && !isNaN(parseFloat(settingsMap['waktu_tenggang_absensi']))
        ? parseFloat(settingsMap['waktu_tenggang_absensi']) : 2;
      const tenggangSecs = waktuTenggangJam * 3600;

      const isGuruMaster   = !settingsMap['absensi_otomatis_guru']     || settingsMap['absensi_otomatis_guru']     === '1';
      const isMadin        = isGuruMaster && (!settingsMap['absensi_otomatis_madin']    || settingsMap['absensi_otomatis_madin']    === '1');
      const isQuran        = isGuruMaster && (!settingsMap['absensi_otomatis_quran']    || settingsMap['absensi_otomatis_quran']    === '1');
      const isKegiatan     = isGuruMaster && (!settingsMap['absensi_otomatis_kegiatan'] || settingsMap['absensi_otomatis_kegiatan'] === '1');

      const nowObj   = new Date();
      const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(nowObj);
      const nowTime  = nowObj.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false });
      const rawDay   = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(nowObj);
      const hariDB   = rawDay === 'Minggu' ? 'Ahad' : rawDay;

      const parseTimeToSec = (tStr) => {
        const [h, m, s] = String(tStr).split(':').map(Number);
        return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
      };
      const nowSecs = parseTimeToSec(nowTime);

      let totalSantri = 0, totalGuru = 0;

      await conn.beginTransaction();

      // ===== 1. JADWAL MADIN =====
      const [madinJadwal] = await conn.execute(
        `SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.kelas_madin_id, km.nama_kelas, j.guru_id
         FROM jadwal_madin j JOIN kelas_madin km ON j.kelas_madin_id = km.kelas_id
         WHERE j.hari = ?`, [hariDB]
      );
      for (const jadwal of madinJadwal) {
        if (nowSecs <= parseTimeToSec(jadwal.jam_selesai) + tenggangSecs) continue;

        if (isMadin && jadwal.guru_id) {
          const [guruAtt] = await conn.execute(
            `SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ? AND jadwal_madin_id = ?`,
            [jadwal.guru_id, todayStr, jadwal.jadwal_id]
          );
          if (guruAtt.length === 0) {
            await conn.execute(
              `INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id) VALUES (?, ?, 'Alpha', 'Otomatis - Tidak Hadir / Mengabsen', 1, ?, ?)`,
              [jadwal.guru_id, todayStr, nowTime, jadwal.jadwal_id]
            );
            totalGuru++;
          }
        }

        const [existing] = await conn.execute(
          'SELECT COUNT(*) as cnt FROM absensi WHERE jadwal_madin_id = ? AND tanggal = ?',
          [jadwal.jadwal_id, todayStr]
        );
        if (existing[0].cnt > 0) continue;

        const [santri] = await conn.execute(
          'SELECT murid_id FROM murid WHERE kelas_madin_id = ? OR kelas_madin_2_id = ?',
          [jadwal.kelas_madin_id, jadwal.kelas_madin_id]
        );
        for (const s of santri) {
          await conn.execute(
            'INSERT IGNORE INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, "Alpha", "Otomatis - Tidak Hadir")',
            [jadwal.jadwal_id, s.murid_id, todayStr]
          );
          totalSantri++;
        }
      }

      // ===== 2. JADWAL QURAN =====
      const [quranJadwal] = await conn.execute(
        `SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.kelas_quran_id, kq.nama_kelas, j.guru_id
         FROM jadwal_quran j JOIN kelas_quran kq ON j.kelas_quran_id = kq.id
         WHERE j.hari = ?`, [hariDB]
      );
      for (const jadwal of quranJadwal) {
        if (nowSecs <= parseTimeToSec(jadwal.jam_selesai) + tenggangSecs) continue;

        if (isQuran && jadwal.guru_id) {
          const [guruAtt] = await conn.execute(
            `SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ? AND jadwal_quran_id = ?`,
            [jadwal.guru_id, todayStr, jadwal.jadwal_id]
          );
          if (guruAtt.length === 0) {
            await conn.execute(
              `INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id) VALUES (?, ?, 'Alpha', 'Otomatis - Tidak Hadir / Mengabsen', 1, ?, ?)`,
              [jadwal.guru_id, todayStr, nowTime, jadwal.jadwal_id]
            );
            totalGuru++;
          }
        }

        const [existing] = await conn.execute(
          'SELECT COUNT(*) as cnt FROM absensi_quran WHERE jadwal_quran_id = ? AND tanggal = ?',
          [jadwal.jadwal_id, todayStr]
        );
        if (existing[0].cnt > 0) continue;

        const [santri] = await conn.execute(
          'SELECT murid_id FROM murid WHERE kelas_quran_id = ?',
          [jadwal.kelas_quran_id]
        );
        for (const s of santri) {
          await conn.execute(
            'INSERT IGNORE INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, "Alpha", "Otomatis - Tidak Hadir")',
            [jadwal.jadwal_id, s.murid_id, todayStr]
          );
          totalSantri++;
        }
      }

      // ===== 3. JADWAL KEGIATAN =====
      const [kegiatanJadwal] = await conn.execute(
        `SELECT j.kegiatan_id as jadwal_id, j.jam_mulai, j.jam_selesai, j.nama_kegiatan, j.kamar_id, k.nama_kamar, j.guru_id
         FROM jadwal_kegiatan j JOIN kamar k ON j.kamar_id = k.kamar_id
         WHERE j.hari = ?`, [hariDB]
      );
      for (const jadwal of kegiatanJadwal) {
        if (nowSecs <= parseTimeToSec(jadwal.jam_selesai) + tenggangSecs) continue;

        if (isKegiatan && jadwal.guru_id) {
          const [guruAtt] = await conn.execute(
            `SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ? AND kegiatan_id = ?`,
            [jadwal.guru_id, todayStr, jadwal.jadwal_id]
          );
          if (guruAtt.length === 0) {
            await conn.execute(
              `INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id) VALUES (?, ?, 'Alpha', 'Otomatis - Tidak Hadir / Mengabsen', 1, ?, ?)`,
              [jadwal.guru_id, todayStr, nowTime, jadwal.jadwal_id]
            );
            totalGuru++;
          }
        }

        const [existing] = await conn.execute(
          'SELECT COUNT(*) as cnt FROM absensi_kegiatan WHERE kegiatan_id = ? AND tanggal = ?',
          [jadwal.jadwal_id, todayStr]
        );
        if (existing[0].cnt > 0) continue;

        const [santri] = await conn.execute(
          'SELECT murid_id FROM murid WHERE kamar_id = ?',
          [jadwal.kamar_id]
        );
        for (const s of santri) {
          await conn.execute(
            'INSERT IGNORE INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, "Alpha", "Otomatis - Tidak Hadir")',
            [jadwal.jadwal_id, s.murid_id, todayStr]
          );
          totalSantri++;
        }
      }

      await conn.commit();
      console.log(`[CRON] Auto-Alpha selesai: ${totalSantri} santri + ${totalGuru} guru ditandai Alpha.`);

    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      console.error('[CRON] Auto-Alpha error:', err.message);
    } finally {
      if (conn) await conn.end().catch(() => {});
    }
  }, { timezone: 'Asia/Jakarta' });

  // --- SINKRONISASI OTOMATIS DATA SANTRI ---
  // Jalankan pengecekan setiap hari pada pukul 02:00 pagi
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Memulai pengecekan sinkronisasi otomatis data santri...');
    
    const mysql = require('mysql2/promise');
    let connection;
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ppmawaro_app_ppma',
        connectTimeout: 10000
      });

      const [rows] = await connection.query(
        "SELECT * FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('rutinitas_sinkronisasi', 'terakhir_sinkronisasi')"
      );

      const settings = {};
      rows.forEach(row => {
        settings[row.nama_pengaturan] = row.nilai;
      });

      const rutinitas = settings.rutinitas_sinkronisasi || 'manual';
      const terakhir = settings.terakhir_sinkronisasi ? new Date(settings.terakhir_sinkronisasi) : null;

      if (rutinitas === 'manual') {
        console.log('[CRON] Rutinitas sinkronisasi diset MANUAL. Melewati...');
        return;
      }

      let isDue = false;
      const now = new Date();

      if (!terakhir) {
        isDue = true;
      } else {
        const diffMs = now - terakhir;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (rutinitas === 'harian' && diffDays >= 0.9) {
          isDue = true;
        } else if (rutinitas === 'mingguan' && diffDays >= 6.9) {
          isDue = true;
        } else if (rutinitas === 'bulanan' && diffDays >= 29.9) {
          isDue = true;
        }
      }

      if (isDue) {
        console.log(`[CRON] Sinkronisasi otomatis terpicu (jadwal: ${rutinitas}). Menghubungi API lokal...`);
        const fetchUrl = `http://127.0.0.1:${port}/api/sync/murid`;
        const res = await fetch(fetchUrl);
        const json = await res.json();
        if (json.success) {
          console.log(`[CRON] Sinkronisasi otomatis berhasil: total_data_mitra=${json.total_data_mitra}, new=${json.new_students}, updated=${json.updated_students}`);
        } else {
          console.error('[CRON] Sinkronisasi otomatis gagal:', json.message || json.error);
        }
      } else {
        console.log(`[CRON] Belum waktunya sinkronisasi (jadwal: ${rutinitas}, terakhir: ${terakhir ? terakhir.toLocaleString() : 'Never'}).`);
      }
    } catch (err) {
      console.error('[CRON] Error saat menjalankan rutinitas sinkronisasi:', err.message);
    } finally {
      if (connection) {
        await connection.end().catch(() => {});
      }
    }
  });

  // API Route Khusus (Bisa juga ditangani oleh Next.js API Routes)
  server.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Express Server & Next.js running normally.',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    });
  });

  // Cegah browser & LiteSpeed caching pada dokumen HTML agar pembaruan tampilan langsung aktif
  server.use((req, res, next) => {
    if (!req.url.startsWith('/_next/static') && !req.url.startsWith('/favicon.ico')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Tangani semua request lain melalui Next.js App Router
  server.use((req, res) => {
    return handle(req, res);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Mode: ${dev ? 'Development' : 'Production'}`);
    console.log(`> Background Worker (Cron) Aktif`);
  });
}).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});
