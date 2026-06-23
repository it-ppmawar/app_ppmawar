const fs = require('fs');
const path = require('path');

// Baca QR codes dari fix_dilewati_output.sql
const sqlOutput = fs.readFileSync(path.join(__dirname, '..', 'fix_dilewati_output.sql'), 'utf-8');
const mainSql   = fs.readFileSync(path.join(__dirname, '..', 'fix_dilewati_output.sql'), 'utf-8');

// Ekstrak QR codes dari file tidak ditemukan
function getQR(filename) {
    // Pattern: -- [TIDAK_DITEMUKAN] FILENAME\n-- QR: VALUE
    const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`-- \\[TIDAK_DITEMUKAN\\] ${escaped}\\n-- QR: ([^\\n]+)`);
    const m  = sqlOutput.match(re);
    return m ? m[1].trim() : null;
}

// ─── Match konfirm otomatis (80-100%) ───
const autoMatches = [
    // 100%
    { file: 'HALIMATUS SA`ADAH.jpg',          type: 'guru',  id: 87,  nama: 'Ustd. Halimatus sa\'adah',    score: 100 },
    { file: 'MUHAMMAD NADHIF.jpg',             type: 'guru',  id: 41,  nama: 'Ust. Nadhif',                 score: 100 },
    { file: 'NAJIHATU AZMI.jpg',               type: 'guru',  id: 120, nama: 'Ustd. Najiha Azmi',           score: 100 },
    // 80%
    { file: 'AHMAD FAIZAL REZA.jpg',           type: 'guru',  id: 40,  nama: 'Ust. Faizal Reza',            score: 80  },
    { file: 'AHMAD NUR ATIQ.jpg',              type: 'guru',  id: 36,  nama: 'Ust. A. Nur Atiq',            score: 80  },
    { file: 'GILANG SETYO PRATOMO.jpg',        type: 'guru',  id: 46,  nama: 'Ust. Gilang Setyo P.',        score: 80  },
];

// ─── Match perlu konfirmasi (57-67%) ───
const needConfirm = [
    { file: 'AHMAD IKMALUL FIKRI.jpg',         type: 'guru',  id: 50,  nama: 'Ust. Achmad Ikmalul Fikri',   score: 67  },
    { file: 'ANINTIAS LAILI FIRDANA.jpg',      type: 'murid', nis: '2025070354', nama: 'ANINTIAS LAILI FIRDANIA', score: 67 },
    { file: 'FANI NUR AFIFAH.jpg',             type: 'guru',  id: 111, nama: 'Ustd. Fany Nur Afifah',       score: 67  },
    { file: 'FATIKH AFAN KURNIAWAN.jpg',       type: 'guru',  id: 42,  nama: 'Ust. Fatikh Affan Kurniawan', score: 67  },
    { file: 'HENIS INSYIROTUL AZIIDAH.jpg',   type: 'guru',  id: 84,  nama: 'Ustd. Henis Insyirotul Azidah', score: 67 },
    { file: 'IFATUR ROHMAH.jpg',               type: 'guru',  id: 115, nama: 'Hj. Iffaturohmah',            score: 67  },
    { file: 'MOH. SYAFIQ SUFYAN KHOIRUR R.jpg', type: 'guru', id: 7,  nama: 'Agus Syafiq Sufyan KR.',       score: 67  },
    { file: 'MOHAMMAD SYAIFULLAH ABID.jpg',    type: 'guru',  id: 34,  nama: 'Ust. M Syaifullah',           score: 67  },
    { file: 'NAJWA DURROTUS TSANIA.jpg',       type: 'murid', nis: '2025070277', nama: 'NAJWA DURROTUS TSANIYAH', score: 67 },
    { file: 'NIKLA SOFIYATUL FAIZAH.jpg',      type: 'guru',  id: 81,  nama: 'Ustd. Nikla Shofiyatul Faizah', score: 67 },
    { file: 'RANI HARITOTUL MAHMUDAH.jpg',     type: 'murid', nis: '2025070588', nama: 'RANI HARIROTUL MAHMUDAH', score: 67 },
    { file: 'SALAHUDDIN ABDUL AZIZ.jpg',       type: 'guru',  id: 44,  nama: 'Ust. Sholahuddin Abdul Aziz', score: 67  },
    { file: 'SITI DJAMILAH, DRA.jpg',          type: 'guru',  id: 56,  nama: 'Hj. Jamilah',                 score: 67  },
    { file: 'MUHAMMAD THOMY HILMY AZIZY.jpg',  type: 'guru',  id: 10,  nama: 'Agus Thomy Hilmy Azizi',      score: 57  },
    { file: 'M NAQOUIB ASHROFUN NASHR.jpg',    type: 'guru',  id: 9,   nama: 'Agus Naqouib Ashrofun Nasr',  score: 57  },
    { file: 'ZAININA ZUBI ZARRETA.jpg',        type: 'guru',  id: 77,  nama: 'Ning Zainina Zuby Zarreta',   score: 57  },
    { file: 'ZULIANA HIDAYATUSZZAHRAH.jpg',    type: 'murid', nis: '2025070287', nama: 'ZULIANA HIDAYATUZZAHRAH', score: 50 },
];

function buildSQL(match, qr) {
    if (!qr) return `-- [SKIP] QR tidak ditemukan untuk: ${match.file}\n`;
    let sql = `-- [MATCH-${match.score}%] ${match.file} => ${match.type.toUpperCase()} ${match.nama}\n`;
    sql += `UPDATE murid SET barcode_id = NULL WHERE barcode_id = '${qr}';\n`;
    sql += `UPDATE guru  SET barcode_id = NULL WHERE barcode_id = '${qr}';\n`;
    if (match.type === 'guru') {
        sql += `UPDATE guru  SET barcode_id = '${qr}' WHERE guru_id = ${match.id};\n`;
    } else {
        sql += `UPDATE murid SET barcode_id = '${qr}' WHERE nis = '${match.nis}';\n`;
    }
    return sql + '\n';
}

// ─── Build output ───
const AUREL_QR = 'djAx2S7+hKwoSSu7tDkpmpdDprq/rI1aW141R6W9Ja5Mlg3cTU3cH3RQRFgO4VQfD2Y=';

let out = `-- ============================================================
-- fix_dilewati_tambahan.sql
-- SQL Perbaikan Tambahan (dari analisis kandidat)
-- Jalankan DI CPANEL setelah fix_dilewati_output.sql
-- ============================================================

-- ============================================================
-- BAGIAN 1: KOREKSI KHUSUS — AUREL salah ke FAJRIYAH
-- ============================================================
-- Foto 1: Kartu asli milik AUREL NUR HABIBATUL LATHIFAH (NIS: 2024070498)
-- Foto 2: QR salah dipasang ke FAJRIYAH NIKMATUS SU\`AMAN
-- Catatan: Koreksi ini sudah termasuk dalam fix_dilewati_output.sql
-- (dari file Copy of AUREL NUR HABIBATUL LATHIFAH.jpg)
-- Tapi ditampilkan di sini untuk kejelasan:
UPDATE murid SET barcode_id = NULL WHERE barcode_id = '${AUREL_QR}';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = '${AUREL_QR}';
UPDATE murid SET barcode_id = '${AUREL_QR}' WHERE nis = '2024070498';
-- Hasil: Kartu Aurel kembali ke Aurel, Fajriyah tidak punya barcode (perlu scan ulang)

-- ============================================================
-- BAGIAN 2: MATCH OTOMATIS (Score 80-100% — SANGAT YAKIN)
-- ============================================================
`;

let autoCount = 0;
for (const m of autoMatches) {
    const qr = getQR(m.file);
    out += buildSQL(m, qr);
    if (qr) autoCount++;
}

out += `
-- ============================================================
-- BAGIAN 3: MATCH PERLU KONFIRMASI (Score 57-67%)
-- Periksa sebelum dijalankan — hapus baris yang tidak yakin
-- ============================================================
`;

let confirmCount = 0;
for (const m of needConfirm) {
    const qr = getQR(m.file);
    out += buildSQL(m, qr);
    if (qr) confirmCount++;
}

const outputPath = path.join(__dirname, '..', 'fix_dilewati_tambahan.sql');
fs.writeFileSync(outputPath, out, 'utf-8');

console.log('=== SELESAI ===');
console.log(`Auto match (80-100%): ${autoCount} query`);
console.log(`Perlu konfirmasi (57-67%): ${confirmCount} query`);
console.log(`Total: ${autoCount + confirmCount} query tambahan`);
console.log(`Disimpan ke: fix_dilewati_tambahan.sql`);
