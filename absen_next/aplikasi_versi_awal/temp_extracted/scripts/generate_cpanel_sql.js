const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/alkaf/.gemini/antigravity/brain/261505e7-d754-4909-a1fb-3016a2ff7c5a/.system_generated/tasks/task-551.log';
const projectRoot = 'd:/koding/absensi_online_ppma/absen_next';

function main() {
  if (!fs.existsSync(logPath)) {
    console.error('Log file tidak ditemukan:', logPath);
    return;
  }

  const logContent = fs.readFileSync(logPath, 'utf8');
  const lines = logContent.split('\n');

  let sqlContent = '-- Auto-generated SQL script untuk sinkronisasi hasil scan ke cPanel\n';
  sqlContent += '-- Silakan import file ini di phpMyAdmin pada database cPanel Anda\n\n';

  let count = 0;

  for (let line of lines) {
    if (line.includes('BERHASIL! Santri')) {
      const match = line.match(/Santri \[([^\]]+)\]\s+.*dipasangkan dengan barcode:\s+(.+)$/);
      if (match) {
        const nis = match[1];
        let barcode = match[2].trim();
        // Hapus ANSI escape codes (seperti \x1b[0m)
        barcode = barcode.replace(/\x1B\[[0-9;]*m/g, '');
        sqlContent += `UPDATE murid SET barcode_id = NULL WHERE barcode_id = '${barcode}';\n`;
        sqlContent += `UPDATE guru SET barcode_id = NULL WHERE barcode_id = '${barcode}';\n`;
        sqlContent += `UPDATE murid SET barcode_id = '${barcode}' WHERE nis = '${nis}';\n`;
        count++;
      }
    } else if (line.includes('BERHASIL! Guru/Pengurus')) {
      const match = line.match(/Guru\/Pengurus\/Sesepuh\s+(.+?)\s+dipasangkan dengan barcode:\s+(.+)$/);
      if (match) {
        // We need to update guru, but we don't have the guru_id from the log, we only have the name.
        // Let's use the name to update. Note: single quotes in names need to be escaped.
        const nama = match[1].replace(/'/g, "''").trim();
        let barcode = match[2].trim();
        // Hapus ANSI escape codes
        barcode = barcode.replace(/\x1B\[[0-9;]*m/g, '');
        sqlContent += `UPDATE murid SET barcode_id = NULL WHERE barcode_id = '${barcode}';\n`;
        sqlContent += `UPDATE guru SET barcode_id = NULL WHERE barcode_id = '${barcode}';\n`;
        sqlContent += `UPDATE guru SET barcode_id = '${barcode}' WHERE nama = '${nama}';\n`;
        count++;
      }
    }
  }

  const sqlPath = path.join(projectRoot, 'sync_cpanel.sql');
  fs.writeFileSync(sqlPath, sqlContent, 'utf8');
  console.log(`Berhasil men-generate ${count} query ke file: ${sqlPath}`);
}

main();
