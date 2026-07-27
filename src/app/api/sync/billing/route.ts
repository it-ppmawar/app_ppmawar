import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

// ============================================================
// SISTEM PEMBAYARAN CLOSE-LOOP:
// - Sel bulan TERISI = Belum Lunas (tagihan masih ada)
// - Sel bulan KOSONG = Sudah Lunas (dibersihkan oleh operator)
// - JUMLAH SYAHRIYAH   = total syahriyah yang belum dibayar
// - JUMLAH JARIYAH     = total jariyah yang belum dibayar
// - JUMLAH DAFTAR ULANG = total daftar ulang yang belum dibayar
// - JUMLAH TOTAL TUNGGAKAN = akumulasi semua yang belum lunas
// - TAGIHAN ACTUAL     = besaran iuran standar bulan ini (referensi)
//
// Periode per Kelas:
// - KELAS I:   1 periode  (12 bulan: Jul → Jun)
// - KELAS II:  2 periode  (24 bulan: Jul → Jun × 2)
// - KELAS III: 3 periode  (36 bulan: Jul → Jun × 3)
// ============================================================

const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQkk9LdLRlfmnjdlCT2d4cSU6TxdpV5x7S__kQx-lb0pSa8s6G5zKp7vYRJPN2Jrv2OJq_5expWDlAE';

const TARGET_SHEETS: { name: string; gid: string; periodeCount: number }[] = [
  { name: 'KELAS I',   gid: '1690459731', periodeCount: 1 },
  { name: 'KELAS II',  gid: '654747842',  periodeCount: 2 },
  { name: 'KELAS III', gid: '758125236',  periodeCount: 3 },
];

// Periode aktif per kelas (tahun ajaran dimulai bulan 7, berakhir bulan 6)
const KELAS_PERIODE: Record<string, string> = {
  'KELAS I':   '2026/2027',
  'KELAS II':  '2025/2026',
  'KELAS III': '2024/2025',
};

/**
 * Parse angka format Rupiah Indonesia:
 * "1.600.000" → 1600000 | "460.000" → 460000 | "" → 0
 * Kolom kosong (sel yang sudah dihapus = Lunas) menghasilkan 0.
 */
function parseRupiahNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.abs(val);
  const str = String(val).trim();
  if (!str || str === '-') return 0;
  const cleaned = str.replace(/Rp\s*/gi, '').trim();
  // Format Indonesia: titik sebagai pemisah ribuan (1.600.000)
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return parseInt(cleaned.replace(/\./g, ''), 10);
  }
  const digits = cleaned.replace(/[^0-9]/g, '');
  const num = parseInt(digits, 10);
  return isNaN(num) ? 0 : num;
}

/** Parse CSV teks menjadi array of arrays */
function parseCsvText(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim()); cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell.trim()); lines.push(row); row = []; cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) { row.push(cell.trim()); lines.push(row); }
  return lines;
}

/** Download CSV dari Google Sheets (published) */
async function fetchPublishedCsv(gid: string): Promise<string[][]> {
  const url = `${PUBLISHED_BASE}/pub?output=csv&gid=${gid}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} saat mengunduh gid=${gid}`);
  return parseCsvText(await res.text());
}

/** Temukan index kolom berdasarkan nama (exact match first, lalu partial) */
function findColIdx(headers: string[], targets: string[]): number {
  for (const t of targets) {
    const upper = t.toUpperCase();
    const idx = headers.findIndex(h => h.toUpperCase() === upper);
    if (idx !== -1) return idx;
  }
  for (const t of targets) {
    const upper = t.toUpperCase();
    const idx = headers.findIndex(h => h.toUpperCase().includes(upper));
    if (idx !== -1) return idx;
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
    const isAllowedToSync = payload && (
      ['admin', 'staff', 'pengasuh', 'pengurus_asrama'].includes(payload.role) ||
      payload.isPengasuh || payload.is_pengasuh || payload.isPengurusAsrama || payload.is_pengurus_asrama
    );
    if (!payload || !isAllowedToSync) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin, Staff, dan Pengasuh/Pengurus Asrama yang dapat melakukan sinkronisasi' }, { status: 403 });
    }

    const result = {
      inserted: 0,
      skipped: 0,
      lunas: 0,
      belum: 0,
      errors: [] as string[],
      details: [] as string[],
    };

    for (const sheet of TARGET_SHEETS) {
      result.details.push(`⬇️ Mengunduh sheet: ${sheet.name}...`);

      let rawData: string[][];
      try {
        rawData = await fetchPublishedCsv(sheet.gid);
      } catch (e: any) {
        result.errors.push(`Gagal mengunduh ${sheet.name}: ${e.message}`);
        continue;
      }

      if (rawData.length < 2) {
        result.errors.push(`Sheet ${sheet.name} kosong`);
        continue;
      }

      // === CARI BARIS HEADER ===
      let headerRowIndex = -1;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(rawData.length, 10); i++) {
        const row = rawData[i];
        if (!row) continue;
        const upperRow = row.map(c => String(c || '').toUpperCase().trim());
        if (upperRow.some(c => c === 'NIS') && upperRow.some(c => c === 'NAMA' || c === 'NAMA SANTRI')) {
          headerRowIndex = i;
          headers = upperRow;
          break;
        }
      }

      if (headerRowIndex === -1) {
        result.errors.push(`Sheet ${sheet.name}: header NIS+NAMA tidak ditemukan`);
        continue;
      }

      // === MAPPING KOLOM ===
      const colNIS            = findColIdx(headers, ['NIS']);
      const colNama           = findColIdx(headers, ['NAMA', 'NAMA SANTRI', 'NAMA LENGKAP']);
      const colSekolah        = findColIdx(headers, ['SEKOLAH', 'UNIT']);
      const colMadrasiah      = findColIdx(headers, ['MADRASIAH', 'MADRASAH']);
      // Kolom JUMLAH (akumulasi yang belum lunas — kolom kosong = sudah lunas)
      const colJumlahSyahriyah   = findColIdx(headers, ['JUMLAH SYAHRIYAH']);
      const colJumlahJariyah     = findColIdx(headers, ['JUMLAH JARIYAH']);
      const colJumlahDaftarUlang = findColIdx(headers, ['JUMLAH DAFTAR ULANG']);
      const colJumlahTotal       = findColIdx(headers, ['JUMLAH TOTAL TUNGGAKAN']);
      // TAGIHAN ACTUAL = besaran iuran standar bulan ini (referensi rate)
      const colTagihanActual     = findColIdx(headers, ['TAGIHAN ACTUAL']);
      // ASRAMA & KAMAR: ambil kemunculan TERAKHIR (dekat TAGIHAN ACTUAL)
      const colAsrama = headers.lastIndexOf('ASRAMA') !== -1 ? headers.lastIndexOf('ASRAMA') : findColIdx(headers, ['ASRAMA']);
      const colKamar  = headers.lastIndexOf('KAMAR')  !== -1 ? headers.lastIndexOf('KAMAR')  : findColIdx(headers, ['KAMAR']);

      if (colNIS === -1 || colNama === -1) {
        result.errors.push(`Sheet ${sheet.name}: kolom NIS/NAMA tidak ditemukan`);
        continue;
      }

      const periode = KELAS_PERIODE[sheet.name] || sheet.name;
      const dataRows = rawData.slice(headerRowIndex + 1);
      let sheetInserted = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every(c => !c || !c.trim())) { result.skipped++; continue; }

        const nisRaw        = row[colNIS];
        const namaFromSheet = String(row[colNama] || '').trim();

        // Lewati baris invalid / baris header ulang
        if (!nisRaw || !namaFromSheet) { result.skipped++; continue; }
        const namaUpper = namaFromSheet.toUpperCase();
        if (['NAMA', 'NAMA SANTRI', 'NO', 'NIS'].includes(namaUpper)) { result.skipped++; continue; }
        const nis = String(nisRaw).trim();
        if (!nis || nis.toUpperCase() === 'NIS') { result.skipped++; continue; }

        // === CROSS-REFERENCE NIS KE DATABASE ===
        let dbMurid: { nama: string; nama_asrama: string; nama_kamar: string } | null = null;
        try {
          const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT m.nama, k.nama_asrama, k.nama_kamar
             FROM murid m LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
             WHERE m.nis = ? LIMIT 1`,
            [nis]
          );
          if (rows.length > 0) dbMurid = rows[0] as any;
        } catch {}

        const nama = dbMurid?.nama || namaFromSheet;

        let asrama = colAsrama !== -1 ? String(row[colAsrama] || '').trim() : '';
        if (/^[A-F]$/i.test(asrama)) asrama = `Asrama ${asrama.toUpperCase()}`;

        let kamar = colKamar !== -1 ? String(row[colKamar] || '').trim() : '';

        // Auto-detect asrama from kamar (e.g. kamar "D-5" -> "Asrama D") if asrama is missing
        if ((!asrama || asrama === '0' || asrama === '-') && kamar && /^[A-F]/i.test(kamar)) {
          asrama = `Asrama ${kamar.charAt(0).toUpperCase()}`;
        }

        if (!asrama || asrama === '0' || asrama === '-') asrama = dbMurid?.nama_asrama || '-';
        if (!kamar || kamar === '0' || kamar === '-') kamar = dbMurid?.nama_kamar || '-';

        // Auto-enrich murid table: update murid.kamar_id if murid has no kamar assigned
        if (asrama && asrama !== '-' && kamar && kamar !== '-') {
          try {
            const asramaCode = asrama.replace(/asrama\s+/i, '').trim().toUpperCase();
            const [kRows] = await pool.execute<RowDataPacket[]>(
              `SELECT kamar_id FROM kamar WHERE (nama_asrama = ? OR nama_asrama = ?) AND (nama_kamar = ? OR nama_kamar = ?) LIMIT 1`,
              [`Asrama ${asramaCode}`, asramaCode, kamar, `${asramaCode}-${kamar}`]
            );
            let kId = kRows.length > 0 ? kRows[0].kamar_id : null;
            if (!kId) {
              const [insK] = await pool.execute(
                `INSERT INTO kamar (nama_kamar, nama_asrama, kapasitas) VALUES (?, ?, 20)`,
                [kamar, asramaCode]
              );
              kId = (insK as any).insertId;
            }
            if (kId) {
              await pool.execute(
                `UPDATE murid SET kamar_id = ? WHERE (nis = ? OR LOWER(TRIM(nama)) = LOWER(TRIM(?))) AND (kamar_id IS NULL OR kamar_id = 0)`,
                [kId, nis, nama]
              );
            }
          } catch (e) {}
        }

        const sekolah   = colSekolah   !== -1 ? String(row[colSekolah]   || '').trim() : '';
        const madrasiah = colMadrasiah !== -1 ? String(row[colMadrasiah] || '').trim() : '';

        // Deteksi tingkatan: Wustho (MA/SMK) vs Ula (MTs/SMP)
        let tingkatan = '';
        if (/WUSTHO|MAK|^MA-|^SMK-/i.test(sekolah) || /WUSTHO|MAK/i.test(madrasiah)) {
          tingkatan = 'Wustho';
        } else if (/ULA|^MTS-|^SMP-/i.test(sekolah) || /ULA/i.test(madrasiah)) {
          tingkatan = 'Ula';
        }

        // === BACA JUMLAH TUNGGAKAN (CLOSE-LOOP LOGIC) ===
        // Kolom kosong di sheet = sudah lunas (dihapus operator setelah pembayaran)
        // Kolom terisi          = masih belum lunas
        const jumlahSyahriyah   = parseRupiahNumber(row[colJumlahSyahriyah]);
        const jumlahJariyah     = parseRupiahNumber(row[colJumlahJariyah]);
        const jumlahDaftarUlang = parseRupiahNumber(row[colJumlahDaftarUlang]);
        const jumlahTotal       = parseRupiahNumber(row[colJumlahTotal]);
        const tagihanActual     = parseRupiahNumber(row[colTagihanActual]); // rate standar

        // STATUS KESELURUHAN: JUMLAH TOTAL TUNGGAKAN = 0 → Lunas, > 0 → Belum
        const statusKeseluruhan = jumlahTotal === 0 ? 'Lunas' : 'Belum';

        // === SIAPKAN TAGIHAN ===
        const billingsToUpsert: {
          namaTagihan: string;
          nominal: number;
          kategori: 'pesantren' | 'madrasah';
          asrama: string;
          kamar: string;
          status: string;
        }[] = [];

        // 1. SYAHRIYAH PESANTREN
        //    - Jika JUMLAH SYAHRIYAH > 0 → Belum, nominal = tunggakan syahriyah
        //    - Jika JUMLAH SYAHRIYAH = 0 → Lunas, nominal = TAGIHAN ACTUAL (referensi)
        const nominalSyahriyah = jumlahSyahriyah > 0 ? jumlahSyahriyah : tagihanActual;
        if (nominalSyahriyah > 0) {
          billingsToUpsert.push({
            namaTagihan: 'Syahriyah Pesantren',
            nominal: nominalSyahriyah,
            kategori: 'pesantren',
            asrama,
            kamar,
            status: jumlahSyahriyah > 0 ? 'Belum' : 'Lunas',
          });
        }

        // 2. JARIYAH PESANTREN
        //    - Jariyah muncul dalam 1, 2, atau 3 termin sesuai KELAS
        //    - Jika JUMLAH JARIYAH > 0 → Belum
        if (jumlahJariyah > 0) {
          billingsToUpsert.push({
            namaTagihan: `Jariyah (${sheet.periodeCount} Termin)`,
            nominal: jumlahJariyah,
            kategori: 'pesantren',
            asrama,
            kamar,
            status: 'Belum',
          });
        }

        // 3. DAFTAR ULANG / DANA KEGIATAN (Madrasah)
        //    - Muncul di Kelas II dan Kelas III (daftar ulang antar periode)
        if (jumlahDaftarUlang > 0) {
          billingsToUpsert.push({
            namaTagihan: `Daftar Ulang ${sheet.name}`,
            nominal: jumlahDaftarUlang,
            kategori: 'madrasah',
            asrama: sheet.name,
            kamar: [sekolah, madrasiah, tingkatan].filter(Boolean).join(' | ') || `${asrama} / ${kamar}`,
            status: 'Belum',
          });
        }

        // === UPSERT KE DATABASE ===
        try {
          // Hapus semua record 'Total Tagihan%' lama agar tidak terjadi double counting
          await pool.execute(
            `DELETE FROM billing WHERE nis = ? AND nama_tagihan LIKE 'Total Tagihan%'`,
            [nis]
          );

          // Hapus record tagihan google_sheet lama yang sudah tidak aktif/berubah nama untuk santri & periode ini
          if (billingsToUpsert.length > 0) {
            const validNames = billingsToUpsert.map(b => b.namaTagihan);
            const placeholders = validNames.map(() => '?').join(',');
            await pool.execute(
              `DELETE FROM billing 
               WHERE nis = ? AND periode = ? AND source = 'google_sheet' 
                 AND nama_tagihan NOT IN (${placeholders})`,
              [nis, periode, ...validNames]
            );
          }

          for (const bill of billingsToUpsert) {
            await pool.execute(
              `INSERT INTO billing (nis, nama_santri, asrama, kamar, nama_tagihan, nominal, status, periode, source, kategori)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'google_sheet', ?)
               ON DUPLICATE KEY UPDATE
                 nama_santri = VALUES(nama_santri),
                 asrama      = VALUES(asrama),
                 kamar       = VALUES(kamar),
                 nominal     = VALUES(nominal),
                 status      = IF(status = 'Lunas' AND VALUES(status) = 'Lunas', 'Lunas',
                               IF(status = 'Lunas' AND VALUES(status) = 'Belum', 'Lunas',
                               VALUES(status))),
                 source      = 'google_sheet',
                 updated_at  = CURRENT_TIMESTAMP`,
              [nis, nama, bill.asrama, bill.kamar, bill.namaTagihan, bill.nominal, bill.status, periode, bill.kategori]
            );
          }
          result.inserted++;
          sheetInserted++;
          if (statusKeseluruhan === 'Lunas') result.lunas++;
          else result.belum++;
        } catch (err: any) {
          result.errors.push(`${sheet.name} baris ${i + 2} (NIS: ${nis}): ${err.message}`);
        }
      }

      result.details.push(`✅ ${sheet.name}: ${sheetInserted} santri diproses (${sheet.periodeCount} periode).`);
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
      message: `Sinkronisasi billing dari ${TARGET_SHEETS.length} sheet (KELAS I, II, III) selesai!`,
      inserted: result.inserted,
      skipped: result.skipped,
      lunas: result.lunas,
      belum: result.belum,
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
