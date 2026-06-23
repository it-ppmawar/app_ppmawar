const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/alkaf/.gemini/antigravity/brain/261505e7-d754-4909-a1fb-3016a2ff7c5a/.system_generated/tasks/task-551.log';
const projectRoot = 'd:/koding/absensi_online_ppma/absen_next';
const kartuDir = path.join(projectRoot, 'kartu_santri');

const berhasilDir = path.join(projectRoot, 'kartu_hasil', '1_BERHASIL');
const gagalDir = path.join(projectRoot, 'kartu_hasil', '2_GAGAL_QR_TIDAK_TERBACA_ATAU_KONFLIK');
const dilewatiDir = path.join(projectRoot, 'kartu_hasil', '3_DILEWATI_NAMA_TIDAK_DITEMUKAN_ATAU_DUPLIKAT');

// Membuat folder jika belum ada
[path.join(projectRoot, 'kartu_hasil'), berhasilDir, gagalDir, dilewatiDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });
  return arrayOfFiles;
}

function main() {
  if (!fs.existsSync(logPath)) {
    console.error('Log file tidak ditemukan:', logPath);
    return;
  }

  const logContent = fs.readFileSync(logPath, 'utf8');
  const lines = logContent.split('\n');

  let fileStatus = {};

  let currentFile = null;

  for (let line of lines) {
    const processMatch = line.match(/\[PROCESS\] Memproses:\s*(.+?\.(?:jpg|jpeg|png|webp|gif|bmp))/i);
    if (processMatch) {
      currentFile = processMatch[1].trim();
    }

    if (line.includes('BERHASIL!') && currentFile) {
      fileStatus[currentFile] = 'BERHASIL';
      currentFile = null;
    } else if ((line.includes('❌') || line.includes('⚠️')) && currentFile) {
      let alasan = line.replace(/.*[❌⚠️]\s*/, '').trim();
      
      if (currentFile.toLowerCase().includes('copy of') || currentFile.match(/\(\d+\)/)) {
          fileStatus[currentFile] = 'DILEWATI';
      } else if (alasan.includes('tidak ditemukan')) {
          fileStatus[currentFile] = 'DILEWATI';
      } else {
          fileStatus[currentFile] = 'GAGAL';
      }
      currentFile = null;
    }
  }

  if (!fs.existsSync(kartuDir)) {
      console.error('Folder kartu_santri tidak ditemukan:', kartuDir);
      return;
  }

  const allFiles = getAllFiles(kartuDir);
  let countBerhasil = 0;
  let countGagal = 0;
  let countDilewati = 0;
  let countUnknown = 0;

  console.log(`Ditemukan ${allFiles.length} file di folder kartu_santri. Memulai pemindahan...`);

  for (const filePath of allFiles) {
      const fileName = path.basename(filePath);
      const status = fileStatus[fileName];
      
      let targetDir = null;
      if (status === 'BERHASIL') {
          targetDir = berhasilDir;
          countBerhasil++;
      } else if (status === 'GAGAL') {
          targetDir = gagalDir;
          countGagal++;
      } else if (status === 'DILEWATI') {
          targetDir = dilewatiDir;
          countDilewati++;
      } else {
          // Jika tidak ada di log (mungkin file bukan gambar atau ekstensi aneh)
          targetDir = dilewatiDir;
          countUnknown++;
      }

      if (targetDir) {
          const targetPath = path.join(targetDir, fileName);
          // Menggunakan copyFileSync agar file asli tidak hilang (untuk keamanan)
          // Jika ingin dipindahkan (cut), ganti menjadi fs.renameSync
          try {
              fs.copyFileSync(filePath, targetPath);
          } catch (e) {
              console.error(`Gagal menyalin ${fileName}:`, e.message);
          }
      }
  }

  console.log('--- RINGKASAN PEMINDAHAN ---');
  console.log(`✅ BERHASIL disalin : ${countBerhasil} file`);
  console.log(`❌ GAGAL disalin    : ${countGagal} file (QR buram/konflik)`);
  console.log(`⚠️ DILEWATI disalin  : ${countDilewati + countUnknown} file (Duplikat, nama salah, bukan gambar)`);
  console.log('Semua file telah di-copy (disalin) ke folder "kartu_hasil" yang ada di dalam absen_next.');
  console.log('File asli di folder "kartu_santri" TIDAK dihapus (hanya disalin demi keamanan).');
}

main();
