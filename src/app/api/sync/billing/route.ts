import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

// URL Sheet yang dipublikasi
const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQkk9LdLRlfmnjdlCT2d4cSU6TxdpV5x7S__kQx-lb0pSa8s6G5zKp7vYRJPN2Jrv2OJq_5expWDlAE';

// Target sheets: KELAS I, KELAS II, KELAS III dengan GID yang sudah kita konfirmasi
const TARGET_SHEETS: { name: string; gid: string }[] = [
  { name: 'KELAS I',   gid: '1690459731' },
  { name: 'KELAS II',  gid: '654747842'  },
  { name: 'KELAS III', gid: '758125236'  },
];

// Periode per kelas
const KELAS_PERIODE: Record<string, string> = {
  'KELAS I':   '2026/2027',
  'KELAS II':  '2025/2026',
  'KELAS III': '2024/2025',
};

/**
 * Parse angka format Rupiah Indonesia:
 * "1.600.000" → 1600000, "460.000" → 460000, "Rp 1.000" → 1000
 */
function parseRupiahNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.abs(val);
  let str = String(val).trim();
  if (!str || str === '-' || str === '') return 0;
  str = str.replace(/Rp\s*/gi, '').trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    return parseInt(str.replace(/\./g, ''), 10);
  }
  const digits = str.replace(/[^0-9]/g, '');
  const num = parseInt(digits, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse CSV teks menjadi array of arrays, handle quoted fields
 */
function parseCsvText(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell.trim());
      lines.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.trim());
    lines.push(row);
  }
  return lines;
}

/**
 * Download CSV dari Google Sheets (published)
 */
async function fetchPublishedCsv(gid: string): Promise<string[][]> {
  const url = `${PUBLISHED_BASE}/pub?output=csv&gid=${gid}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} saat mengunduh gid=${gid}`);
  const text = await response.text();
  return parseCsvText(text);
}

/**
 * Temukan index kolom berdasarkan nama yang cocok (case-insensitive, partial match)
 */
function findColIdx(headers: string[], targets: string[]): number {
  for (const t of targets) {
    const upper = t.toUpperCase();
    const exact = headers.findIndex(h => h.toUpperCase() === upper);
    if (exact !== -1) return exact;
  }
  for (const t of targets) {
    const upper = t.toUpperCase();
    const partial = headers.findIndex(h => h.toUpperCase().includes(upper));
    if (partial !== -1) return partial;
  }
  return -1;
}

export async function POST(request: Request) {
  try {
    // === AUTENTIKASI ===
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin/Staff yang dapat melakukan sinkronisasi' }, { status: 403 });
    }

    const result = {
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as string[],
    };

    for (const sheet of TARGET_SHEETS) {
      result.details.push(`Memproses sheet: ${sheet.name}...`);

      let rawData: string[][];
      try {
        rawData = await fetchPublishedCsv(sheet.gid);
      } catch (e: any) {
        result.errors.push(`Gagal mengunduh ${sheet.name}: ${e.message}`);
        continue;
      }

      if (rawData.length < 2) {
        result.errors.push(`Sheet ${sheet.name} kosong atau tidak memiliki data`);
        continue;
      }

      // === CARI BARIS HEADER ===
      let headerRowIndex = -1;
      let headers: string[] = [];

      for (let i = 0; i < Math.min(rawData.length, 10); i++) {
        const row = rawData[i];
        if (!row) continue;
        const upperRow = row.map(c => String(c || '').toUpperCase().trim());
        const hasNIS  = upperRow.some(c => c === 'NIS');
        const hasNAMA = upperRow.some(c => c === 'NAMA' || c === 'NAMA SANTRI' || c === 'NAMA LENGKAP');
        if (hasNIS && hasNAMA) {
          headerRowIndex = i;
          headers = upperRow;
          break;
        }
      }

      if (headerRowIndex === -1) {
        result.errors.push(`Sheet ${sheet.name}: tidak ditemukan baris header (NIS + NAMA)`);
        continue;
      }

      // === MAPPING KOLOM ===
      const colNIS          = findColIdx(headers, ['NIS']);
      const colNama         = findColIdx(headers, ['NAMA', 'NAMA SANTRI', 'NAMA LENGKAP']);
      const colSekolah      = findColIdx(headers, ['SEKOLAH', 'UNIT']);
      const colMadrasiah    = findColIdx(headers, ['MADRASIAH', 'MADRASAH']);
      const colSyahriyah    = findColIdx(headers, ['JUMLAH SYAHRIYAH', 'SYAHRIYAH']);
      const colJariyah      = findColIdx(headers, ['JUMLAH JARIYAH', 'JARIYAH I', 'JARIYAH']);
      const colDaftarUlang  = findColIdx(headers, ['JUMLAH DAFTAR ULANG', 'DAFTAR ULANG', 'DANA KEGIATAN']);
      const colTotalTunggakan = findColIdx(headers, ['JUMLAH TOTAL TUNGGAKAN', 'TOTAL TUNGGAKAN', 'TOTAL']);
      const colTagihanActual  = findColIdx(headers, ['TAGIHAN ACTUAL']);
      const colAsramaLast   = headers.lastIndexOf('ASRAMA');
      const colKamarLast    = headers.lastIndexOf('KAMAR');
      const colAsrama       = colAsramaLast !== -1 ? colAsramaLast : findColIdx(headers, ['ASRAMA']);
      const colKamar        = colKamarLast  !== -1 ? colKamarLast  : findColIdx(headers, ['KAMAR']);

      if (colNIS === -1 || colNama === -1) {
        result.errors.push(`Sheet ${sheet.name}: kolom NIS atau NAMA tidak ditemukan`);
        continue;
      }

      const periode = KELAS_PERIODE[sheet.name] || sheet.name;

      // === PROSES SETIAP BARIS DATA ===
      const dataRows = rawData.slice(headerRowIndex + 1);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every(cell => !cell || cell.trim() === '')) {
          result.skipped++;
          continue;
        }

        const nisRaw = row[colNIS];
        const namaFromSheet = String(row[colNama] || '').trim();

        if (!nisRaw || !namaFromSheet) {
          result.skipped++;
          continue;
        }

        const namaUpper = namaFromSheet.toUpperCase();
        if (namaUpper === 'NAMA' || namaUpper === 'NAMA SANTRI' || namaUpper === 'NO') {
          result.skipped++;
          continue;
        }

        const nis = String(nisRaw).trim();
        if (!nis || nis.toUpperCase() === 'NIS') {
          result.skipped++;
          continue;
        }

        // === CROSS-REFERENCE DENGAN DATABASE (NIS-based) ===
        let dbMurid: { nama: string; nama_asrama: string; nama_kamar: string } | null = null;
        try {
          const [muridRows] = await pool.execute<RowDataPacket[]>(
            `SELECT m.nama, k.nama_asrama, k.nama_kamar
             FROM murid m
             LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
             WHERE m.nis = ? LIMIT 1`,
            [nis]
          );
          if (muridRows.length > 0) {
            dbMurid = muridRows[0] as any;
          }
        } catch {}

        const nama = dbMurid?.nama || namaFromSheet;

        let asrama = colAsrama !== -1 ? String(row[colAsrama] || '').trim() : '';
        if (!asrama || asrama === '0' || asrama === '-') {
          asrama = dbMurid?.nama_asrama || 'Asrama A';
        }
        if (/^[A-F]$/i.test(asrama)) {
          asrama = `Asrama ${asrama.toUpperCase()}`;
        }

        let kamar = colKamar !== -1 ? String(row[colKamar] || '').trim() : '';
        if (!kamar || kamar === '0' || kamar === '-') {
          kamar = dbMurid?.nama_kamar || '-';
        }

        const sekolah   = colSekolah   !== -1 ? String(row[colSekolah]   || '').trim() : '';
        const madrasiah = colMadrasiah !== -1 ? String(row[colMadrasiah] || '').trim() : '';

        // Deteksi ULA (MTs/SMP) vs WUSTHO (MA/SMK)
        let tingkatanDiniyah = '';
        if (/WUSTHO|MAK|MA-|SMK-/i.test(sekolah) || /WUSTHO|MAK/i.test(madrasiah)) {
          tingkatanDiniyah = 'Wustho';
        } else if (/ULA|MTS-|SMP-/i.test(sekolah) || /ULA/i.test(madrasiah)) {
          tingkatanDiniyah = 'Ula';
        }

        // === PARSING NOMINAL ===
        const syahriyah    = parseRupiahNumber(row[colSyahriyah]);
        const jariyah      = parseRupiahNumber(row[colJariyah]);
        const daftarUlang  = parseRupiahNumber(row[colDaftarUlang]);
        const tagihanActual = colTagihanActual !== -1 ? parseRupiahNumber(row[colTagihanActual]) : 0;
        const totalTunggakan = colTotalTunggakan !== -1 ? parseRupiahNumber(row[colTotalTunggakan]) : 0;

        const nominalPesantren = tagihanActual > 0 ? tagihanActual : (syahriyah + jariyah);
        const nominalMadrasah  = totalTunggakan > 0 ? totalTunggakan : (syahriyah + jariyah + daftarUlang);

        if (nominalPesantren <= 0 && nominalMadrasah <= 0 && syahriyah <= 0 && jariyah <= 0) {
          result.skipped++;
          continue;
        }

        // === SIAPKAN TAGIHAN UNTUK UPSERT ===
        const billingsToUpsert: {
          namaTagihan: string;
          nominal: number;
          kategori: 'pesantren' | 'madrasah';
          asrama: string;
          kamar: string;
          status: string;
        }[] = [];

        // 1. Tagihan PESANTREN: Syahriyah Pesantren (dari TAGIHAN ACTUAL)
        if (nominalPesantren > 0) {
          billingsToUpsert.push({
            namaTagihan: 'Syahriyah Pesantren',
            nominal: nominalPesantren,
            kategori: 'pesantren',
            asrama,
            kamar,
            status: 'Belum',
          });
        }

        // 2. Tagihan MADRASAH: Total tagihan (dari JUMLAH TOTAL TUNGGAKAN)
        if (nominalMadrasah > 0) {
          const detailUnit = [sekolah, madrasiah ? `[${madrasiah}]` : ''].filter(Boolean).join(' ');
          const unitLabel  = detailUnit ? ` (${detailUnit})` : '';
          const tingkatanInfo = tingkatanDiniyah ? ` ${tingkatanDiniyah}` : '';

          billingsToUpsert.push({
            namaTagihan: `Tagihan ${sheet.name}${unitLabel}`,
            nominal: nominalMadrasah,
            kategori: 'madrasah',
            asrama: sheet.name, // KELAS I, KELAS II, KELAS III
            kamar: detailUnit ? `${detailUnit}${tingkatanInfo} | ${asrama} ${kamar}` : `${asrama} ${kamar}`,
            status: 'Belum',
          });
        }

        // 3. Breakdown Jariyah terpisah jika ada
        if (jariyah > 0 && nominalPesantren === 0) {
          billingsToUpsert.push({
            namaTagihan: 'Jariyah',
            nominal: jariyah,
            kategori: 'pesantren',
            asrama,
            kamar,
            status: 'Belum',
          });
        }

        // === UPSERT KE DATABASE ===
        try {
          for (const bill of billingsToUpsert) {
            if (bill.nominal <= 0) continue;

            await pool.execute(
              `INSERT INTO billing (nis, nama_santri, asrama, kamar, nama_tagihan, nominal, status, periode, source, kategori)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'google_sheet', ?)
               ON DUPLICATE KEY UPDATE
                 nama_santri = VALUES(nama_santri),
                 asrama      = VALUES(asrama),
                 kamar       = VALUES(kamar),
                 nominal     = VALUES(nominal),
                 status      = IF(status = 'Lunas', 'Lunas', VALUES(status)),
                 source      = 'google_sheet',
                 updated_at  = CURRENT_TIMESTAMP`,
              [nis, nama, bill.asrama, bill.kamar, bill.namaTagihan, bill.nominal, bill.status, periode, bill.kategori]
            );
          }
          result.inserted++;
        } catch (err: any) {
          result.errors.push(`${sheet.name} baris ${i + 2} (NIS: ${nis}): ${err.message}`);
        }
      }

      result.details.push(`Sheet ${sheet.name}: selesai.`);
    }

    const nowStr = new Date().toISOString();
    try {
      await pool.execute(
        `INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai)
         VALUES ('terakhir_sync_billing', ?)
         ON DUPLICATE KEY UPDATE nilai = ?`,
        [nowStr, nowStr]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi billing dari ${TARGET_SHEETS.length} sheet Google Sheets berhasil!`,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
      details: result.details,
      synced_at: nowStr,
    });

  } catch (error: any) {
    console.error('Error Google Sheets Sync Billing:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal sinkronisasi billing: ' + error.message },
      { status: 500 }
    );
  }
}
