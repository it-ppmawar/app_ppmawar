/**
 * scratch_deploy_standalone.js
 * 
 * Script ini akan:
 * 1. Build Next.js (standalone mode)
 * 2. Menyusun folder deploy (static files, public, dll)
 * 3. Injeksi cron job ke dalam server.js bawaan Next.js standalone
 * 4. Install runtime deps minimal (node-cron) di standalone
 * 5. Buat ZIP siap upload ke cPanel menggunakan .NET Compression
 * 
 * Jalankan: node scratch_deploy_standalone.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = 'D:\\koding\\app_absensi_online_ppma\\absen_next';
const standaloneDir = path.join(projectDir, '.next', 'standalone');
const outputZip = 'D:\\koding\\app_absensi_online_ppma\\absen_deploy_final.zip';

// ─── STEP 1: Build ───────────────────────────────────────────────────────────
console.log('\n📦 STEP 1: Menjalankan npm run build...\n');
try {
  execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
  console.log('\n✅ Build berhasil!\n');
} catch (err) {
  console.error('❌ Build gagal!', err.message);
  process.exit(1);
}

// ─── STEP 2: Pastikan standalone ada ─────────────────────────────────────────
if (!fs.existsSync(standaloneDir)) {
  console.error('❌ Folder .next/standalone tidak ditemukan!');
  process.exit(1);
}
console.log('✅ Folder standalone ditemukan');

// ─── Helper ───────────────────────────────────────────────────────────────────
function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const item of fs.readdirSync(from)) {
    const srcPath = path.join(from, item);
    const dstPath = path.join(to, item);
    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// ─── STEP 3: Copy .next/static → standalone/.next/static ─────────────────────
console.log('\n📂 STEP 3: Menyalin file static...');
const staticSrc = path.join(projectDir, '.next', 'static');
const staticDst = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  copyFolderSync(staticSrc, staticDst);
  console.log('✅ Static files disalin');
}

// ─── STEP 4: Copy public → standalone/public ─────────────────────────────────
console.log('\n📂 STEP 4: Menyalin folder public...');
copyFolderSync(path.join(projectDir, 'public'), path.join(standaloneDir, 'public'));
console.log('✅ Public folder disalin');

// ─── STEP 5: Injeksi Cron ke Server Standalone ───────────────────────────────
console.log('\n📂 STEP 5: Menyalin helper scripts & Injeksi Cron ke server.js...');

// Salin scratch_create_tables.js
const createTablesSrc = path.join(projectDir, 'scratch_create_tables.js');
if (fs.existsSync(createTablesSrc)) {
  fs.copyFileSync(createTablesSrc, path.join(standaloneDir, 'scratch_create_tables.js'));
  console.log('✅ scratch_create_tables.js disalin');
}

// Injeksi Cron ke server.js bawaan Next.js standalone
const serverJsPath = path.join(standaloneDir, 'server.js');
if (fs.existsSync(serverJsPath)) {
  const cronCode = `
// --- BACKGROUND WORKER (CRON INJECTED BY DEPLOY SCRIPT) ---
try {
  const cron = require('node-cron');
  
  // Cron 1: Absensi Guru (8:00 AM)
  cron.schedule('0 8 * * *', () => {
    console.log('[CRON] Menjalankan pengecekan otomatisasi absensi guru...');
  });

  // Cron 2: Sinkronisasi Santri (2:00 AM)
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Memulai pengecekan sinkronisasi otomatis data santri...');
    const mysql = require('mysql2/promise');
    let connection;
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ppmawaro_absensi_ppma',
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
        console.log(\`[CRON] Sinkronisasi otomatis terpicu (jadwal: \${rutinitas}). Menghubungi API lokal...\`);
        const port = process.env.PORT || 3000;
        const fetchUrl = \`http://127.0.0.1:\${port}/api/sync/murid\`;
        const res = await fetch(fetchUrl);
        const json = await res.json();
        if (json.success) {
          console.log(\`[CRON] Sinkronisasi otomatis berhasil: total_data_mitra=\${json.total_data_mitra}, new=\${json.new_students}, updated=\${json.updated_students}\`);
        } else {
          console.error('[CRON] Sinkronisasi otomatis gagal:', json.message || json.error);
        }
      } else {
        console.log(\`[CRON] Belum waktunya sinkronisasi (jadwal: \${rutinitas}, terakhir: \${terakhir ? terakhir.toLocaleString() : 'Never'}).\`);
      }
    } catch (err) {
      console.error('[CRON] Error saat menjalankan rutinitas sinkronisasi:', err.message);
    } finally {
      if (connection) {
        await connection.end().catch(() => {});
      }
    }
  });
  console.log('[CRON] Background Worker (Cron) Aktif');
} catch (cronErr) {
  console.error('[CRON] Gagal menginisialisasi Cron:', cronErr.message);
}
`;
  fs.appendFileSync(serverJsPath, cronCode);
  console.log('✅ Cron injected successfully into standalone server.js');
} else {
  console.error('❌ server.js standalone tidak ditemukan untuk di-injeksi!');
  process.exit(1);
}

// ─── STEP 6: Install runtime deps minimal di standalone ──────────────────────
console.log('\n📦 STEP 6: Install node-cron di folder standalone...');
try {
  execSync(
    'npm install node-cron --no-save --legacy-peer-deps',
    { cwd: standaloneDir, stdio: 'inherit' }
  );
  console.log('\n✅ Runtime deps terinstall');
} catch (err) {
  console.error('❌ Gagal install node-cron:', err.message);
  process.exit(1);
}

// ─── STEP 7: Buat ZIP menggunakan .NET Compression ───────────────────────────
console.log('\n🗜️  STEP 7: Membuat ZIP deploy...');
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
  console.log('🗑️  ZIP lama dihapus');
}

try {
  // Gunakan .NET ZipFile untuk performa super cepat & stabil di Windows
  const psCommand = `powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem'); [System.IO.Compression.ZipFile]::CreateFromDirectory('${standaloneDir}', '${outputZip}')"`;
  execSync(psCommand, { stdio: 'inherit' });
  const sizeMB = (fs.statSync(outputZip).size / (1024 * 1024)).toFixed(1);
  console.log(`\n✅ ZIP berhasil dibuat di: ${outputZip} (${sizeMB} MB)`);
} catch (err) {
  console.error('❌ Gagal kompresi ZIP:', err.message);
  process.exit(1);
}

console.log('\n🎉 PROSES SELESAI!');
console.log('   Silakan upload absen_deploy_final.zip terbaru ke cPanel Anda!');
