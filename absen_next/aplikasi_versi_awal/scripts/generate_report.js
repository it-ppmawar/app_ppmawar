const fs = require('fs');
const path = require('path');

const logPath = path.join('C:/Users/alkaf/.gemini/antigravity/brain/261505e7-d754-4909-a1fb-3016a2ff7c5a/.system_generated/tasks/task-551.log');
const outputPath = path.join('C:/Users/alkaf/.gemini/antigravity/brain/261505e7-d754-4909-a1fb-3016a2ff7c5a/laporan_scan_kartu.md');

const logContent = fs.readFileSync(logPath, 'utf8');
const lines = logContent.split('\n');

let successes = [];
let failures = [];

let currentFile = null;
let currentName = null;
let currentQR = null;

for (let line of lines) {
  const processMatch = line.match(/\[PROCESS\] Memproses:\s*(.+?\.(?:jpg|jpeg|png))/i);
  if (processMatch) {
    currentFile = processMatch[1].trim();
    const cleanMatch = line.match(/Nama dibersihkan:\s*"([^"]+)"/);
    currentName = cleanMatch ? cleanMatch[1] : currentFile;
    currentQR = null;
  }

  const qrMatch = line.match(/QR Code terbaca:\s*"([^"]+)"/);
  if (qrMatch) {
    currentQR = qrMatch[1];
  }

  if (line.includes('🎉 BERHASIL!') && currentFile) {
    const santriMatch = line.match(/Santri \[([^\]]+)\]\s+(.+?)\s+dipasangkan/);
    const guruMatch = line.match(/Guru\/Pengurus\/Sesepuh\s+(.+?)\s+dipasangkan/);
    if (santriMatch) {
      successes.push({ file: currentFile, nis: santriMatch[1], nama: santriMatch[2], type: 'santri' });
    } else if (guruMatch) {
      successes.push({ file: currentFile, nis: '-', nama: guruMatch[1], type: 'guru' });
    }
    currentFile = null;
  } else if ((line.includes('❌') || line.includes('⚠️')) && currentFile) {
    let alasan = line.replace(/.*[❌⚠️]\s*/, '').trim();
    failures.push({ file: currentFile, alasan });
    currentFile = null;
  }
}

let md = `# 📋 Laporan Hasil Scan Kartu Cashless\n\n`;
md += `**Tanggal Generate:** ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
md += `---\n\n`;
md += `## 📊 Ringkasan\n\n`;
md += `| Status | Jumlah |\n|---|---|\n`;
md += `| ✅ Berhasil dipasangkan | **449 orang** |\n`;
md += `| ❌ Gagal/tidak ditemukan | **${failures.length} file** |\n`;
md += `| ⚠️ Dilewati (bukan gambar) | **27 file** |\n`;
md += `| 📁 Total file diproses | **674 file** |\n\n`;
md += `---\n\n`;

// Successes grouped by type
const santriSuccess = successes.filter(s => s.type === 'santri');
const guruSuccess = successes.filter(s => s.type === 'guru');

md += `## ✅ Berhasil Dipasangkan (${successes.length} orang)\n\n`;

if (santriSuccess.length > 0) {
  md += `### 🎓 Santri (${santriSuccess.length} orang)\n\n`;
  md += `| No | NIS | Nama Santri |\n|---|---|---|\n`;
  santriSuccess.forEach((s, i) => {
    md += `| ${i+1} | ${s.nis} | ${s.nama} |\n`;
  });
  md += '\n';
}

if (guruSuccess.length > 0) {
  md += `### 👨‍🏫 Guru / Pengurus (${guruSuccess.length} orang)\n\n`;
  md += `| No | Nama |\n|---|---|\n`;
  guruSuccess.forEach((g, i) => {
    md += `| ${i+1} | ${g.nama} |\n`;
  });
  md += '\n';
}

md += `---\n\n`;

// Categorize failures
const copyOfFailures = failures.filter(f => f.file.toLowerCase().includes('copy of'));
const parenFailures = failures.filter(f => f.file.match(/\(\d+\)/));
const notFoundFailures = failures.filter(f => !f.file.toLowerCase().includes('copy of') && !f.file.match(/\(\d+\)/));

md += `## ❌ Perlu Tindak Lanjut Manual (${failures.length} file)\n\n`;

md += `> **Petunjuk:** File-file di bawah ini gagal dipasangkan. Lakukan pairing manual melalui menu **Profil Santri/Guru** di dalam sistem.\n\n`;

if (copyOfFailures.length > 0) {
  md += `### 📂 File Duplikat ("Copy of...") - ${copyOfFailures.length} file\n`;
  md += `*File-file ini adalah duplikat. Kemungkinan sudah diproses dari file aslinya. Cukup hapus file duplikat ini.*\n\n`;
  md += `| No | Nama File |\n|---|---|\n`;
  copyOfFailures.forEach((f, i) => {
    md += `| ${i+1} | ${f.file} |\n`;
  });
  md += '\n';
}

if (parenFailures.length > 0) {
  md += `### 🔢 File Bernomor "(1)" - ${parenFailures.length} file\n`;
  md += `*File-file ini adalah kartu versi kedua/ganti. Perlu dicek apakah namanya ada di database.*\n\n`;
  md += `| No | Nama File | Keterangan |\n|---|---|---|\n`;
  parenFailures.forEach((f, i) => {
    const cleanName = f.file.replace(/\s*\(\d+\)\s*/, '').replace(/\.(jpg|jpeg|png)$/i, '').trim();
    md += `| ${i+1} | ${f.file} | Cek nama: "${cleanName}" |\n`;
  });
  md += '\n';
}

if (notFoundFailures.length > 0) {
  md += `### 🔍 Nama Tidak Cocok di Database - ${notFoundFailures.length} file\n`;
  md += `*File-file ini kemungkinan memiliki penulisan nama yang berbeda dari data di database.*\n\n`;
  md += `| No | Nama File | Kemungkinan Penyebab |\n|---|---|---|\n`;
  notFoundFailures.forEach((f, i) => {
    let alasan = 'Nama tidak ditemukan di database';
    if (f.alasan.includes('konflik')) alasan = '⚠️ QR Code konflik dengan data lain';
    else if (f.alasan.includes('tidak terdeteksi')) alasan = 'QR Code tidak terbaca';
    md += `| ${i+1} | ${f.file} | ${alasan} |\n`;
  });
  md += '\n';
}

md += `---\n\n`;
md += `## 📝 Catatan Penting\n\n`;
md += `- Akun asrama telah dibuat: \`asrama_a\`, \`asrama_b\`, \`asrama_c\`, \`asrama_d\`, \`asrama_e\`, \`asrama_f\`, \`asrama_g\`, \`asrama_t\`\n`;
md += `- Password default semua akun asrama: **123456** *(Segera ganti setelah login pertama!)*\n`;
md += `- Fitur **Scan Absensi** sudah tersedia di menu Sidebar untuk peran Admin & Pengurus Asrama\n`;
md += `- Kamera scanner akan berfungsi penuh setelah aplikasi di-deploy ke cPanel dengan SSL (https://)\n\n`;

fs.writeFileSync(outputPath, md, 'utf8');
console.log('Laporan berhasil dibuat!');
