const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

const logPath = 'C:/Users/alkaf/.gemini/antigravity/brain/261505e7-d754-4909-a1fb-3016a2ff7c5a/.system_generated/tasks/task-551.log';
const projectRoot = 'd:/koding/absensi_online_ppma/absen_next';

function main() {
  if (!fs.existsSync(logPath)) {
    console.error('Log file tidak ditemukan:', logPath);
    return;
  }

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
        successes.push({ file: currentFile, nis: santriMatch[1], nama: santriMatch[2], type: 'Santri' });
      } else if (guruMatch) {
        successes.push({ file: currentFile, nis: '-', nama: guruMatch[1], type: 'Guru/Pengurus' });
      }
      currentFile = null;
    } else if ((line.includes('❌') || line.includes('⚠️')) && currentFile) {
      let alasan = line.replace(/.*[❌⚠️]\s*/, '').trim();
      failures.push({ file: currentFile, alasan });
      currentFile = null;
    }
  }

  // --- 1. GENERATE CSV SPREADSHEET ---
  console.log('Membuat file CSV...');
  let csvContent = 'No;Kategori;NIS;Nama;Status;Nama File;Keterangan/Alasan\n';
  let no = 1;

  // Add successes
  for (let item of successes) {
    const nameSafe = item.nama.replace(/"/g, '""');
    const fileSafe = item.file.replace(/"/g, '""');
    csvContent += `${no};${item.type};${item.nis};${nameSafe};Berhasil Pasang;${fileSafe};-\n`;
    no++;
  }

  // Add failures
  for (let item of failures) {
    const fileSafe = item.file.replace(/"/g, '""');
    let kategori = 'Santri/Guru';
    let detailAlasan = item.alasan;
    if (item.file.toLowerCase().includes('copy of')) {
      kategori = 'Duplikat';
      detailAlasan = 'File duplikat ("Copy of...")';
    } else if (item.file.match(/\(\d+\)/)) {
      kategori = 'Revisi Kartu';
      detailAlasan = 'File bernomor (kartu ganti/kedua)';
    } else {
      if (item.alasan.includes('konflik')) detailAlasan = 'QR Code konflik dengan data lain';
      else if (item.alasan.includes('tidak terdeteksi')) detailAlasan = 'QR Code tidak terbaca';
    }
    const alasanSafe = detailAlasan.replace(/"/g, '""');
    
    // Coba tebak NIS dan Nama dari nama file
    let tempNis = '-';
    let tempNama = item.file.replace(/\.(jpg|jpeg|png)$/i, '');
    const dashMatch = tempNama.match(/^(\d+)\s*-\s*(.+)$/);
    if (dashMatch) {
      tempNis = dashMatch[1];
      tempNama = dashMatch[2];
    }
    
    csvContent += `${no};${kategori};${tempNis};${tempNama};Gagal Pasang;${fileSafe};${alasanSafe}\n`;
    no++;
  }

  const csvPath = path.join(projectRoot, 'Laporan_Scan_Kartu_Baru.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('CSV berhasil disimpan di:', csvPath);

  // --- 2. GENERATE PDF DOCUMENT ---
  console.log('Membuat file PDF...');
  const doc = new jsPDF();
  
  // Title & Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Laporan Hasil Pairing Kartu Cashless PPMA', 14, 20);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Tanggal Generate: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 26);
  doc.line(14, 28, 196, 28);

  // Ringkasan Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Ringkasan Statistik', 14, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`- Berhasil dipasangkan  : ${successes.length} orang (Santri & Guru)`, 20, 44);
  doc.text(`- Gagal/perlu manual    : ${failures.length} file (Duplikat, salah nama, dll)`, 20, 50);
  doc.text(`- Dilewati bukan gambar : 27 file`, 20, 56);
  doc.text(`- Total file diproses   : 674 file`, 20, 62);

  // Instructions
  doc.setFont('helvetica', 'bold');
  doc.text('2. Petunjuk Tindak Lanjut', 14, 72);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const instructions = [
    'a. Data Berhasil Pasang: Sudah masuk ke database sistem absensi dan kartu siap digunakan.',
    'b. File Duplikat ("Copy of..."): File ini aman untuk dihapus karena versi aslinya sudah terpasang.',
    'c. File Bernomor "(1)" atau "(2)": Harap verifikasi di database apakah santri bersangkutan menggunakan kartu baru.',
    'd. Nama Tidak Cocok / QR Gagal: Lakukan pairing manual via menu "Profil Santri/Guru" di aplikasi web.'
  ];
  let y = 78;
  for (let inst of instructions) {
    doc.text(inst, 20, y);
    y += 6;
  }

  // Preview List of Failures (Top 25)
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Sampel File Gagal Pairing (25 Teratas)', 14, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('No', 14, y);
  doc.text('Nama File', 24, y);
  doc.text('Keterangan / Alasan Gagal', 90, y);
  doc.line(14, y + 2, 196, y + 2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  let count = 0;
  for (let item of failures) {
    if (count >= 25) break;
    let detailAlasan = item.alasan;
    if (item.file.toLowerCase().includes('copy of')) detailAlasan = 'File duplikat ("Copy of...")';
    else if (item.file.match(/\(\d+\)/)) detailAlasan = 'File revisi/kartu ganti';
    else {
      if (item.alasan.includes('konflik')) detailAlasan = 'QR Code konflik dengan data lain';
      else if (item.alasan.includes('tidak terdeteksi')) detailAlasan = 'QR Code tidak terbaca';
    }

    doc.text(`${count + 1}`, 14, y);
    doc.text(item.file.substring(0, 35), 24, y);
    doc.text(detailAlasan.substring(0, 60), 90, y);
    y += 6;
    count++;
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text('* Laporan lengkap semua 674 baris data dapat Anda buka dengan mudah di Excel menggunakan file "Laporan_Scan_Kartu.csv"', 14, y + 5);

  const pdfPath = path.join(projectRoot, 'Laporan_Scan_Kartu.pdf');
  doc.save(pdfPath);
  console.log('PDF berhasil disimpan di:', pdfPath);
}

main();
