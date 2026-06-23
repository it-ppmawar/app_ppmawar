const fs = require('fs');
const sql = fs.readFileSync('ppmawaro_absensi_ppma.sql', 'utf-8');

// Find all INSERT INTO `murid` blocks using string search (no regex for table name)
const murid = [];
let searchFrom = 0;
let blockCount = 0;

while (true) {
    const blockStart = sql.indexOf('INSERT INTO `murid`', searchFrom);
    if (blockStart < 0) break;
    blockCount++;
    
    // Find end of this INSERT block (semicolon on its own line)
    const blockEnd = sql.indexOf(';\n', blockStart);
    const block = sql.substring(blockStart, blockEnd > 0 ? blockEnd + 2 : blockStart + 600000);
    
    // Extract rows: (id, 'NAMA', 'NIS', ...)
    const rowRe = /\((\d+),\s*'((?:[^'\\]|\\.)*)'\s*,\s*'(\d+)'/g;
    let m;
    while ((m = rowRe.exec(block)) !== null) {
        murid.push({ id: m[1], nama: m[2], nis: m[3] });
    }
    
    searchFrom = blockEnd > 0 ? blockEnd + 2 : blockStart + 1;
}

console.log('INSERT blocks found:', blockCount);
console.log('Total murid parsed:', murid.length);

// Test specific names
const tests = ['alicya', 'elok', 'aurel nur', 'alya khairani', 'wahyuni', 'zahra riski', 'shiellah', 'mutiara azzahra', 'kanza', 'meirza'];
tests.forEach(n => {
    const found = murid.filter(r => r.nama.toLowerCase().includes(n.toLowerCase()));
    if (found.length) console.log('[ADA]', n, '->', found.map(r => r.nama).join(', '));
    else console.log('[TIDAK]', n);
});
