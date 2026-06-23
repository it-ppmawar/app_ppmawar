const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

const INPUT_DIR  = path.join(__dirname, '..', 'kartu_hasil', '3_DILEWATI_NAMA_TIDAK_DITEMUKAN_ATAU_DUPLIKAT');
const SQL_FILE   = path.join(__dirname, '..', 'ppmawaro_absensi_ppma.sql');
const OUTPUT_SQL = path.join(__dirname, '..', 'fix_dilewati_output.sql');

// ─────────────────────────────────────────────
// Parse SQL dump — baca SEMUA blok INSERT murid & guru
// ─────────────────────────────────────────────
function parseSQL(sqlContent) {
    const murid = [];
    const guru  = [];

    // ── MURID: loop semua blok INSERT INTO `murid` ──
    let searchFrom = 0;
    while (true) {
        const blockStart = sqlContent.indexOf('INSERT INTO `murid`', searchFrom);
        if (blockStart < 0) break;
        const blockEnd = sqlContent.indexOf(';\n', blockStart);
        const block    = sqlContent.substring(blockStart, blockEnd > 0 ? blockEnd + 2 : blockStart + 600000);
        const rowRe    = /\((\d+),\s*'((?:[^'\\]|\\.)*)'\s*,\s*'(\d+)'/g;
        let m;
        while ((m = rowRe.exec(block)) !== null) {
            murid.push({ id: m[1], nama: m[2], nis: m[3] });
        }
        searchFrom = blockEnd > 0 ? blockEnd + 2 : blockStart + 1;
    }

    // ── GURU: loop semua blok INSERT INTO `guru` ──
    searchFrom = 0;
    while (true) {
        const blockStart = sqlContent.indexOf('INSERT INTO `guru`', searchFrom);
        if (blockStart < 0) break;
        const blockEnd = sqlContent.indexOf(';\n', blockStart);
        const block    = sqlContent.substring(blockStart, blockEnd > 0 ? blockEnd + 2 : blockStart + 200000);
        const rowRe    = /\((\d+),\s*(?:NULL|\d+),\s*'((?:[^'\\]|\\.)*)'/g;
        let m;
        while ((m = rowRe.exec(block)) !== null) {
            guru.push({ id: m[1], nama: m[2] });
        }
        searchFrom = blockEnd > 0 ? blockEnd + 2 : blockStart + 1;
    }

    return { murid, guru };
}

// ─────────────────────────────────────────────
// Normalise name (untuk perbandingan)
// ─────────────────────────────────────────────
function normaliseName(name) {
    return name
        .toLowerCase()
        // Hapus backtick, apostrof khusus (untuk karakter 'ain Arab)
        .replace(/[`''ʼ]/g, '')
        // Hapus gelar akademis di akhir: , DRS / , DRA / , M.AG / , S.PD / , M.P / M.P.I dll
        .replace(/,\s*(?:drs?|dra?|m\.?ag|s\.?pd|m\.?p\.?i?|m\.?pd|s\.?ag|m\.?m|ph\.?d)\.?\s*$/gi, '')
        // Hapus prefix gelar: H. / HJ. / KH. / DR. / DRS. / USTD. / USTDZ. di awal
        .replace(/^(h|hj|kh|dr|drs|dra|ustd|ustdz|prof)\.\s*/gi, '')
        // Hapus nomor urut di akhir: (1) (2) - 1 dll
        .replace(/[\s\-]*\(?\d+\)?$/g, '')
        // Ganti tanda hubung/underscore/backtick dengan spasi
        .replace(/[-_]/g, ' ')
        // Hapus karakter non-alfanumerik kecuali spasi dan titik
        .replace(/[^\w\s.]/g, ' ')
        // Normalisasi spasi
        .replace(/\s+/g, ' ')
        .trim();
}

// Bersihkan nama dari filename
function cleanFilename(filename) {
    let name = filename.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
    // Hapus prefix '---' atau '--' di awal
    name = name.replace(/^-+/, '');
    // Hapus prefix 'Copy of ' (case-insensitive)
    name = name.replace(/^copy\s+of\s+/i, '');
    return name.trim();
}

// Kata-kata tidak signifikan (terlalu umum, tidak membantu identifikasi)
const STOP_WORDS = new Set(['nur', 'nuru', 'al', 'el', 'bin', 'binti', 'bte', 'bt', 'abd', 'and', 'the', 'of', 'dan']);

function significantWords(text) {
    return text.split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
        .filter(w => w !== '');
}

// ─────────────────────────────────────────────
// Matching — aman & ketat
// ─────────────────────────────────────────────
function findMatches(rawFilename, dbList) {
    const cleanFile  = normaliseName(rawFilename);
    const fileWords  = significantWords(cleanFile);

    const results = [];

    for (const r of dbList) {
        const cleanDb  = normaliseName(r.nama);
        const dbWords  = significantWords(cleanDb);

        // (a) Exact match setelah normalisasi
        if (cleanFile === cleanDb) {
            results.push({ ...r, method: 'exact', score: 100 });
            continue;
        }

        // (b) Semua kata file ada di DB (file ⊆ DB) — aman, DB punya nama lengkap
        if (fileWords.length >= 2 && fileWords.every(w => cleanDb.includes(w))) {
            results.push({ ...r, method: 'file-in-db', score: 80 });
            continue;
        }

        // (c) Semua kata DB ada di file (DB ⊆ file) — hanya jika DB punya ≥ 3 kata signifikan
        //     atau semua kata DB ada & DB memiliki ≥ 2 kata dengan panjang ≥ 5 huruf
        if (dbWords.length >= 2 && dbWords.every(w => cleanFile.includes(w))) {
            const longWords = dbWords.filter(w => w.length >= 5);
            if (dbWords.length >= 3 || longWords.length >= 2) {
                results.push({ ...r, method: 'db-in-file', score: 70 });
                continue;
            }
        }

        // (d) ≥ 3 kata signifikan bersama ada di kedua sisi
        const commonWords = fileWords.filter(w => cleanDb.includes(w));
        if (commonWords.length >= 3 && commonWords.every(w => w.length >= 4)) {
            results.push({ ...r, method: 'common-3', score: 60 });
            continue;
        }
    }

    // Kembalikan hanya yang score tertinggi jika ada beberapa
    if (results.length === 0) return { results: [], method: 'none' };

    const maxScore = Math.max(...results.map(r => r.score));
    const best = results.filter(r => r.score === maxScore);
    return { results: best, method: best[0]?.method || 'none' };
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
    if (!fs.existsSync(INPUT_DIR)) { console.error(`[ERROR] Folder tidak ditemukan: ${INPUT_DIR}`); return; }
    if (!fs.existsSync(SQL_FILE))  { console.error(`[ERROR] File SQL tidak ditemukan: ${SQL_FILE}`); return; }

    console.log(`\x1b[36m[INFO] Memuat data dari SQL dump...\x1b[0m`);
    const sqlContent = fs.readFileSync(SQL_FILE, 'utf-8');
    const { murid: dbMurid, guru: dbGuru } = parseSQL(sqlContent);
    console.log(`\x1b[32m[OK] Murid: ${dbMurid.length}, Guru: ${dbGuru.length}\x1b[0m\n`);

    const allFiles = fs.readdirSync(INPUT_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    console.log(`[INFO] Total file gambar: ${allFiles.length}\n`);

    let sqlLines = [
        '-- ============================================',
        '-- fix_dilewati_output.sql  (v2)',
        '-- Generated by fix_dilewati.js',
        '-- Jalankan di cPanel phpMyAdmin',
        '-- ============================================\n',
    ];

    let countMatch    = 0;
    let countNoQR     = 0;
    let countNotFound = 0;
    let countDuplikat = 0;

    // Log untuk analisis
    const notFoundLog = [];

    for (const file of allFiles) {
        const filePath  = path.join(INPUT_DIR, file);
        const rawName   = cleanFilename(file);

        process.stdout.write(`\x1b[35m[PROSES]\x1b[0m ${file}\n`);

        // Scan QR
        let qrValue = null;
        try {
            const buf   = fs.readFileSync(filePath);
            const image = await Jimp.read(buf);
            const qr    = jsQR(image.bitmap.data, image.bitmap.width, image.bitmap.height);
            if (qr) qrValue = qr.data.replace(/\x1B\[[0-9;]*m/g, '').trim();
        } catch (e) {
            console.log(`  \x1b[31m[ERROR] Gagal baca gambar: ${e.message}\x1b[0m\n`);
        }

        if (!qrValue) {
            console.log(`  \x1b[31m[NO_QR] QR tidak terbaca\x1b[0m\n`);
            countNoQR++;
            notFoundLog.push(`NO_QR   | ${file}`);
            continue;
        }
        console.log(`  \x1b[32m[QR]\x1b[0m "${qrValue.substring(0,30)}..."`);
        console.log(`  \x1b[33m[NAMA]\x1b[0m "${normaliseName(rawName)}"`);

        // Cari kecocokan
        const { results: muridHits, method: muridMethod } = findMatches(rawName, dbMurid);
        const { results: guruHits,  method: guruMethod  } = findMatches(rawName, dbGuru);

        const totalHits = muridHits.length + guruHits.length;

        if (totalHits === 0) {
            console.log(`  \x1b[31m[TIDAK_DITEMUKAN]\x1b[0m\n`);
            sqlLines.push(`-- [TIDAK_DITEMUKAN] ${file}`);
            sqlLines.push(`-- QR: ${qrValue}\n`);
            countNotFound++;
            notFoundLog.push(`NOTFOUND| ${file} | ${normaliseName(rawName)}`);
            continue;
        }

        if (totalHits > 1) {
            const namaList = [
                ...muridHits.map(m => `Murid:${m.nama}`),
                ...guruHits.map(g => `Guru:${g.nama}`),
            ].join(' | ');
            console.log(`  \x1b[33m[DUPLIKAT]\x1b[0m ${totalHits} kemungkinan → ${namaList}\n`);
            sqlLines.push(`-- [DUPLIKAT] ${file}`);
            sqlLines.push(`-- Kemungkinan: ${namaList}`);
            sqlLines.push(`-- QR: ${qrValue}\n`);
            countDuplikat++;
            continue;
        }

        // Tepat 1 kecocokan
        if (muridHits.length === 1) {
            const r = muridHits[0];
            console.log(`  \x1b[32m[MATCH-${r.method.toUpperCase()}]\x1b[0m Murid: ${r.nama} (NIS: ${r.nis})\n`);
            sqlLines.push(`-- [MATCH-${r.method}] ${file}`);
            sqlLines.push(`-- Murid: ${r.nama} (NIS: ${r.nis}) | QR: ${qrValue}`);
            sqlLines.push(`UPDATE murid SET barcode_id = NULL WHERE barcode_id = '${qrValue}';`);
            sqlLines.push(`UPDATE guru  SET barcode_id = NULL WHERE barcode_id = '${qrValue}';`);
            sqlLines.push(`UPDATE murid SET barcode_id = '${qrValue}' WHERE nis = '${r.nis}';\n`);
            countMatch++;
        } else {
            const r = guruHits[0];
            console.log(`  \x1b[32m[MATCH-${r.method.toUpperCase()}]\x1b[0m Guru: ${r.nama} (ID: ${r.id})\n`);
            sqlLines.push(`-- [MATCH-${r.method}] ${file}`);
            sqlLines.push(`-- Guru: ${r.nama} (ID: ${r.id}) | QR: ${qrValue}`);
            sqlLines.push(`UPDATE murid SET barcode_id = NULL WHERE barcode_id = '${qrValue}';`);
            sqlLines.push(`UPDATE guru  SET barcode_id = NULL WHERE barcode_id = '${qrValue}';`);
            sqlLines.push(`UPDATE guru  SET barcode_id = '${qrValue}' WHERE guru_id = ${r.id};\n`);
            countMatch++;
        }
    }

    fs.writeFileSync(OUTPUT_SQL, sqlLines.join('\n'), 'utf-8');

    // Simpan log nama tidak ditemukan untuk analisis
    const logPath = path.join(__dirname, '..', 'fix_dilewati_notfound.txt');
    fs.writeFileSync(logPath, notFoundLog.join('\n'), 'utf-8');

    console.log('\x1b[36m══════════════ RINGKASAN ══════════════\x1b[0m');
    console.log(`\x1b[32m  Berhasil dicocokkan : ${countMatch}\x1b[0m`);
    console.log(`\x1b[31m  QR tidak terbaca    : ${countNoQR}\x1b[0m`);
    console.log(`\x1b[31m  Tidak ditemukan     : ${countNotFound}\x1b[0m`);
    console.log(`\x1b[33m  Duplikat (lewati)   : ${countDuplikat}\x1b[0m`);
    console.log(`\x1b[36m  Total file          : ${allFiles.length}\x1b[0m`);
    console.log(`\x1b[36m══════════════════════════════════════\x1b[0m`);
    console.log(`\n\x1b[32m[SELESAI]\x1b[0m SQL        → fix_dilewati_output.sql`);
    console.log(`\x1b[32m[SELESAI]\x1b[0m Tidak cocok → fix_dilewati_notfound.txt`);
}

main().catch(err => {
    console.error('\x1b[31m[FATAL ERROR]\x1b[0m', err.message);
    process.exit(1);
});
