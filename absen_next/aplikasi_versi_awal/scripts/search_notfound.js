const fs = require('fs');
const path = require('path');

const SQL_FILE    = path.join(__dirname, '..', 'ppmawaro_absensi_ppma.sql');
const NOTFOUND    = path.join(__dirname, '..', 'fix_dilewati_notfound.txt');
const OUTPUT_FILE = path.join(__dirname, '..', 'fix_notfound_candidates.txt');

// ─── Parse DB ───
function parseSQL(sqlContent) {
    const murid = [], guru = [];
    let searchFrom = 0;
    while (true) {
        const start = sqlContent.indexOf('INSERT INTO `murid`', searchFrom);
        if (start < 0) break;
        const end   = sqlContent.indexOf(';\n', start);
        const block = sqlContent.substring(start, end > 0 ? end + 2 : start + 600000);
        const re    = /\((\d+),\s*'((?:[^'\\]|\\.)*)'\s*,\s*'(\d+)'/g;
        let m;
        while ((m = re.exec(block)) !== null) murid.push({ id: m[1], nama: m[2], nis: m[3], type: 'murid' });
        searchFrom = end > 0 ? end + 2 : start + 1;
    }
    searchFrom = 0;
    while (true) {
        const start = sqlContent.indexOf('INSERT INTO `guru`', searchFrom);
        if (start < 0) break;
        const end   = sqlContent.indexOf(';\n', start);
        const block = sqlContent.substring(start, end > 0 ? end + 2 : start + 200000);
        const re    = /\((\d+),\s*(?:NULL|\d+),\s*'((?:[^'\\]|\\.)*)'/g;
        let m;
        while ((m = re.exec(block)) !== null) guru.push({ id: m[1], nama: m[2], type: 'guru' });
        searchFrom = end > 0 ? end + 2 : start + 1;
    }
    return [...murid, ...guru];
}

// ─── Normalise ───
function norm(s) {
    return s.toLowerCase()
        .replace(/[`''ʼ]/g, '')
        .replace(/,\s*(?:drs?|dra?|m\.?ag|s\.?pd|m\.?p\.?i?|m\.?pd|s\.?ag|m\.?m|ph\.?d)\.?\s*$/gi, '')
        .replace(/^(h|hj|kh|dr|drs|dra|ustd|ustdz|prof|ust)\.\s*/gi, '')
        .replace(/\b(m\.|moh\.|mohammad|muhammad)\s*/gi, '')
        .replace(/[-_]/g, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ─── Word similarity score ───
function wordScore(a, b) {
    const wa = a.split(/\s+/).filter(w => w.length > 2);
    const wb = b.split(/\s+/).filter(w => w.length > 2);
    if (wa.length === 0 || wb.length === 0) return 0;
    const common = wa.filter(w => wb.some(x => x.includes(w) || w.includes(x)));
    return (2 * common.length) / (wa.length + wb.length);
}

// ─── Main ───
const sqlContent = fs.readFileSync(SQL_FILE, 'utf-8');
const allDB      = parseSQL(sqlContent);
console.log(`DB loaded: ${allDB.length} entries (murid+guru)`);

const notfoundLines = fs.readFileSync(NOTFOUND, 'utf-8').split('\n').filter(l => l.startsWith('NOTFOUND'));
console.log(`Searching for ${notfoundLines.length} unmatched names...\n`);

const results = [];

for (const line of notfoundLines) {
    const parts    = line.split('|');
    const filename = parts[1]?.trim() || '';
    const cleanName = parts[2]?.trim() || '';

    const normFile = norm(cleanName);

    // Score each DB entry
    const scored = allDB.map(r => ({
        ...r,
        normNama: norm(r.nama),
        score: wordScore(normFile, norm(r.nama))
    })).filter(r => r.score > 0.4).sort((a, b) => b.score - a.score).slice(0, 3);

    const info = {
        file: filename,
        cleanName,
        candidates: scored
    };
    results.push(info);
}

// Write output
let out = '=== KANDIDAT COCOK UNTUK NAMA YANG TIDAK DITEMUKAN ===\n\n';
let foundCount = 0;
for (const r of results) {
    if (r.candidates.length > 0) {
        foundCount++;
        out += `FILE    : ${r.file}\n`;
        out += `DICARI  : ${r.cleanName}\n`;
        r.candidates.forEach((c, i) => {
            const id = c.type === 'murid' ? `NIS: ${c.nis}` : `ID: ${c.id}`;
            out += `  [${i+1}] ${c.type.toUpperCase()} ${c.nama} (${id}) - score: ${(c.score*100).toFixed(0)}%\n`;
        });
        out += '\n';
    } else {
        out += `FILE    : ${r.file}\n`;
        out += `DICARI  : ${r.cleanName}\n`;
        out += `  [TIDAK ADA KANDIDAT]\n\n`;
    }
}

out += `\nTotal dengan kandidat: ${foundCount} dari ${results.length}`;
fs.writeFileSync(OUTPUT_FILE, out, 'utf-8');
console.log(out);
console.log(`\nDisimpan ke: fix_notfound_candidates.txt`);
