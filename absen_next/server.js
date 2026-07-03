const express = require('express');
const next = require('next');
const cron = require('node-cron');
const path = require('path');

// Load environment variables manually for the custom server
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = express();

  // Middleware (Hanya gunakan jika membuat API custom murni Express)
  // Jangan gunakan express.json() secara global karena akan merusak Next.js API Routes (App Router)

  // --- CONTOH CRON JOB ---
  // Jalankan setiap jam 08:00 pagi
  cron.schedule('0 8 * * *', () => {
    console.log('[CRON] Menjalankan pengecekan otomatisasi absensi guru...');
    // Logika sinkronisasi Google Sheets / Notifikasi jadwal masuk di sini
  });

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
    res.json({ status: 'ok', message: 'Express Server & Next.js running normally.' });
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
