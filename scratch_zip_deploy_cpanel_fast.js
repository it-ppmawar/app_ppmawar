const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = 'D:\\koding\\app_absensi_online_ppma\\absen_next';
const outputZip = 'D:\\koding\\app_absensi_online_ppma\\absen_cpanel_fast.zip';
const tempDir = path.join(projectDir, 'temp_zip_cpanel');

console.log('⚡ STEP 1: Membersihkan folder temporer lama jika ada...');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

console.log('⚡ STEP 2: Menjalankan npm run build...');
try {
  execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
  console.log('✅ Build berhasil!');
} catch (err) {
  console.error('❌ Build gagal!', err.message);
  process.exit(1);
}

// Helper to copy directory recursively but excluding specific items
function copyFolderSync(from, to, excludePatterns = []) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    // Check if element matches any exclude pattern
    if (excludePatterns.some(pat => element === pat || new RegExp(pat).test(element))) {
      return;
    }
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath, excludePatterns);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

console.log('⚡ STEP 3: Menyalin folder .next (tanpa cache)...');
copyFolderSync(
  path.join(projectDir, '.next'),
  path.join(tempDir, '.next'),
  ['cache', 'standalone']
);

console.log('⚡ STEP 4: Menyalin file-file penting lainnya...');
const filesToCopy = [
  'public',
  'package.json',
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'tsconfig.json',
  'server.js',
  'scratch_create_tables.js'
];

filesToCopy.forEach(item => {
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

console.log('⚡ STEP 5: Membuat ZIP menggunakan PowerShell...');
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

try {
  // Gunakan .NET ZipFile untuk kompresi cepat
  const psCommand = `powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem'); [System.IO.Compression.ZipFile]::CreateFromDirectory('${tempDir}', '${outputZip}')"`;
  execSync(psCommand, { stdio: 'inherit' });
  const sizeMB = (fs.statSync(outputZip).size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ ZIP berhasil dibuat di: ${outputZip} (${sizeMB} MB)`);
} catch (err) {
  console.error('❌ Gagal kompresi ZIP:', err.message);
} finally {
  console.log('🧹 Membersihkan folder temporer...');
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('\n🎉 SELESAI! Silakan upload absen_cpanel_fast.zip ke cPanel Anda!');
