const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');

function analyzeSheetStructure() {
  const wb = xlsx.readFile('D:/koding/app.ppmawar/data_madin/SANTRI BARU FIKS 2025-1.xlsx');
  const sheet = wb.Sheets['PEGANGAN SANTRI'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log('=== STRUCTURE OF PEGANGAN SANTRI SHEET ===');
  console.log('Total rows:', data.length);

  data.slice(0, 100).forEach((row, i) => {
    // filter non-empty cells
    const nonEmp = row.map((c, colIdx) => ({ colIdx, val: String(c).trim() })).filter(x => x.val !== '');
    if (nonEmp.length > 0) {
      console.log(`Row ${i+1}:`, nonEmp.map(x => `[Col ${x.colIdx}]: "${x.val}"`).join(' | '));
    }
  });
}

analyzeSheetStructure();
