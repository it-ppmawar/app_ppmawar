/**
 * scratch_make_zip.js
 * Membuat ZIP dari folder standalone menggunakan adm-zip
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const standaloneDir = path.join(__dirname, '.next', 'standalone');
const outputZip = 'D:\\koding\\app_absensi_online_ppma\\absen_deploy_final.zip';

// Install adm-zip jika belum ada
try {
  require.resolve('adm-zip');
} catch {
  console.log('Installing adm-zip...');
  execSync('npm install adm-zip --no-save', { cwd: __dirname, stdio: 'inherit' });
}

const AdmZip = require('adm-zip');

if (!fs.existsSync(standaloneDir)) {
  console.error('❌ Folder standalone tidak ditemukan!');
  process.exit(1);
}

// Hapus ZIP lama
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
  console.log('🗑️  ZIP lama dihapus');
}

console.log(`📦 Membuat ZIP dari: ${standaloneDir}`);
console.log(`   Output: ${outputZip}\n`);

const zip = new AdmZip();

// Fungsi rekursif untuk tambah file
function addDir(dirPath, zipPath) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const entryPath = zipPath ? path.join(zipPath, item) : item;
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      addDir(fullPath, entryPath);
    } else {
      zip.addLocalFile(fullPath, zipPath || '');
    }
  }
}

console.log('⏳ Menambahkan file ke ZIP (ini mungkin butuh beberapa menit)...');
addDir(standaloneDir, '');

console.log('⏳ Menulis ZIP ke disk...');
zip.writeZip(outputZip);

const sizeMB = (fs.statSync(outputZip).size / (1024 * 1024)).toFixed(1);
console.log(`\n✅ ZIP berhasil: ${outputZip}`);
console.log(`   Ukuran: ${sizeMB} MB`);
console.log('\n🎉 SELESAI! Upload file ini ke cPanel.');
