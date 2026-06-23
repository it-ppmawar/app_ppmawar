const fs = require('fs');
const path = require('path');

function main() {
  const sqlPath = path.join(__dirname, '..', 'ppmawaro_absensi_ppma.sql');
  if (!fs.existsSync(sqlPath)) {
    return;
  }
  const content = fs.readFileSync(sqlPath, 'utf-8');
  
  // Let's find any ALTER TABLE adding barcode_id or similar
  const lines = content.split('\n');
  console.log('--- SCANNING FOR BARCODE ---');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('barcode_id')) {
      console.log(`Line ${i + 1}: ${lines[i]}`);
    }
  }
}
main();
