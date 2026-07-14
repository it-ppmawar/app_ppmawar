const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = 'D:\\koding\\app_absensi_online_ppma\\absen_next';
const outputZip = 'D:\\koding\\app_absensi_online_ppma\\absen_next_cpanel_updated.zip';
const tempDir = path.join(projectDir, 'temp_zip_dist');

// Bersihkan tempDir jika sudah ada
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// Fungsi untuk menyalin folder secara rekursif
function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    if (element === 'node_modules' || element === '.next' || element === '.git' || element === 'temp_zip_dist') {
      return;
    }
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

console.log('Menyalin file project ke folder temporer...');
// Salin file/folder root Next.js
// CATATAN: package-lock.json SENGAJA tidak diikutkan
// agar server generate fresh lock file sesuai versi package.json yang baru
const itemsToCopy = [
  'src', 'public',
  'package.json',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'tailwind.config.js', 'tailwind.config.ts',
  'tsconfig.json',
  'postcss.config.js', 'postcss.config.mjs',
  'jsconfig.json',
  'server.js',
  'scratch_create_tables.js',
];

itemsToCopy.forEach(item => {
  const srcPath = path.join(projectDir, item);
  const dstPath = path.join(tempDir, item);
  if (fs.existsSync(srcPath)) {
    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
});

console.log('Membuat file ZIP menggunakan PowerShell Compress-Archive...');
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

try {
  // Jalankan Compress-Archive via PowerShell
  execSync(`powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${outputZip}' -Force"`);
  console.log(`✓ Berhasil membuat file ZIP di: ${outputZip}`);
  const stats = fs.statSync(outputZip);
  console.log(`Ukuran file ZIP: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
} catch (err) {
  console.error('Gagal membuat ZIP:', err.message);
} finally {
  // Bersihkan tempDir
  console.log('Membersihkan folder temporer...');
  fs.rmSync(tempDir, { recursive: true, force: true });
}
