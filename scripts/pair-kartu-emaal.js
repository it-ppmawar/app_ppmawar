/**
 * Script Lokal: Pairing Kartu eMaal 2026/2027
 * Menyalin file kartu dari folder sumber ke public/kartu_emaal/
 * Jalankan: node scripts/pair-kartu-emaal.js
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'KARTU EMAAL 2026 2027');
const targetDir = path.join(__dirname, '..', 'public', 'kartu_emaal');

if (!fs.existsSync(sourceDir)) {
  console.error('❌ Folder sumber tidak ditemukan:', sourceDir);
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('📁 Folder target dibuat:', targetDir);
}

const files = fs.readdirSync(sourceDir);
let copied = 0;
let skipped = 0;

for (const filename of files) {
  const ext = path.extname(filename).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    skipped++;
    continue;
  }

  const nis = path.basename(filename, ext).trim();
  if (!nis) continue;

  const srcFile = path.join(sourceDir, filename);
  const destFile = path.join(targetDir, `${nis}.jpg`);

  try {
    fs.copyFileSync(srcFile, destFile);
    copied++;
    if (copied % 50 === 0) console.log(`  ✅ ${copied} kartu disalin...`);
  } catch (e) {
    console.error(`  ❌ Gagal menyalin ${filename}:`, e.message);
  }
}

console.log('\n========================================');
console.log(`✅ Selesai! Total disalin: ${copied} kartu`);
console.log(`⏭️  Dilewati (bukan gambar): ${skipped} file`);
console.log(`📂 Hasil ada di: ${targetDir}`);
console.log('\nLangkah selanjutnya:');
console.log('  git add public/kartu_emaal/');
console.log('  git commit -m "feat: add eMaal cards 2026/2027 to public folder"');
console.log('  git push origin main');
console.log('\nSetelah deploy, jalankan:');
console.log('  GET https://app.ppmawar.or.id/api/sync/kartu-emaal');
console.log('  (untuk update database di server)');
