import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { listSheets, readSheet } from '@/lib/googleSheets';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

function findCol(headers: string[], targets: string[]) {
  for (const t of targets) {
    const idx = headers.indexOf(t.toUpperCase());
    if (idx !== -1) return idx;
  }
  for (const t of targets) {
    const idx = headers.findIndex(h => h.includes(t.toUpperCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function POST(request: Request) {
  try {
    // === AUTHENTICATION ===
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin/Staff yang dapat melakukan sinkronisasi' }, { status: 403 });
    }

    // === FETCH SHEET NAMES ===
    const sheetNames = await listSheets();
    const result = { inserted: 0, skipped: 0, errors: [] as string[] };

    for (const sheetName of sheetNames) {
      const cleanSheetName = sheetName.trim().toUpperCase();
      let kategori: 'pesantren' | 'madrasah' = 'pesantren';

      if (/^(ASRAMA\s+)?[A-F]$/i.test(cleanSheetName)) {
        kategori = 'pesantren';
      } else if (/KELAS\s*\d|^(IX|XII|XI|X)\s|MTS-|SMP-|MA-|SMK-|^\d+\s*(MTS|SMP|MA|SMK)/i.test(cleanSheetName)) {
        kategori = 'madrasah';
      } else {
        // Skip irrelevant sheets
        continue;
      }

      // Read raw rows
      const rawData = await readSheet(sheetName);
      if (rawData.length < 2) continue;

      let headerRowIndex = -1;
      let colNIS = -1;
      let colNama = -1;
      let colAsrama = -1;
      let colKamar = -1;
      let colSyahriyah = -1;
      let colJariyah = -1;
      let colDaftarUlang = -1;
      let colTotal = -1;

      for (let i = 0; i < Math.min(rawData.length, 15); i++) {
        const row = rawData[i];
        if (!row) continue;
        
        const rowHeaders = row.map((h: any) => String(h || '').toUpperCase().trim());
        
        const idxNIS = rowHeaders.indexOf('NIS');
        const idxNama = findCol(rowHeaders, ['NAMA', 'NAMA LENGKAP', 'NAMA SANTRI']);
        
        if (idxNIS !== -1 && idxNama !== -1) {
          headerRowIndex = i;
          colNIS = idxNIS;
          colNama = idxNama;
          colAsrama = findCol(rowHeaders, ['ASRAMA']);
          colKamar = findCol(rowHeaders, ['KAMAR']);
          colSyahriyah = findCol(rowHeaders, ['JUMLAH SYAHRIYAH', 'SYAHRIYAH', 'SPP']);
          colJariyah = findCol(rowHeaders, ['JUMLAH JARIYAH', 'JARIYAH', 'JARIYAH I']);
          colDaftarUlang = findCol(rowHeaders, ['JUMLAH DAFTAR ULANG', 'DAFTAR ULANG', 'DANA KEGIATAN']);
          colTotal = findCol(rowHeaders, ['JUMLAH TOTAL TUNGGAKAN', 'TOTAL TUNGGAKAN', 'TOTAL', 'JUMLAH TOTAL']);
          break;
        }
      }

      if (headerRowIndex === -1) {
        continue;
      }

      const headerRowHeaders = rawData[headerRowIndex].map((h: any) => String(h || '').toUpperCase().trim());
      const colStatus = findCol(headerRowHeaders, ['STATUS ADMINISTRASI', 'STATUS']);

      const dataRows = rawData.slice(headerRowIndex + 1).filter((row: any[]) => {
        return row && row.some(cell => cell !== null && cell !== undefined && cell !== '');
      });

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const nisRaw = row[colNIS];
        const nama = String(row[colNama] || '').trim();
        
        if (!nisRaw || !nama || ['NAMA', 'NAMA LENGKAP', 'NAMA SANTRI'].includes(nama.toUpperCase())) {
          result.skipped++;
          continue;
        }

        const nis = String(nisRaw).trim();

        let asrama = colAsrama !== -1 ? String(row[colAsrama] || '').trim() : '';
        if (!asrama || asrama === '0') {
          asrama = sheetName.trim();
        }
        
        if (asrama.length === 1 && /^[A-F]$/i.test(asrama)) {
          asrama = `Asrama ${asrama.toUpperCase()}`;
        }

        const kamar = colKamar !== -1 ? String(row[colKamar] || '').trim() : '';

        const syahriyah = colSyahriyah !== -1 ? Number(row[colSyahriyah] || 0) : 0;
        const jariyah = colJariyah !== -1 ? Number(row[colJariyah] || 0) : 0;
        const daftarUlang = colDaftarUlang !== -1 ? Number(row[colDaftarUlang] || 0) : 0;
        const totalTunggakan = colTotal !== -1 ? Number(row[colTotal] || 0) : (syahriyah + jariyah + daftarUlang);

        const statusAdm = colStatus !== -1 ? String(row[colStatus] || '').trim() : '';
        const isLunasFromSheet = /lunas/i.test(statusAdm) && !/belum/i.test(statusAdm);

        if (totalTunggakan <= 0 && syahriyah <= 0 && jariyah <= 0 && daftarUlang <= 0 && !isLunasFromSheet) {
          result.skipped++;
          continue;
        }

        const billings = [
          { name: 'Syahriyah', amount: syahriyah },
          { name: 'Jariyah', amount: jariyah },
          { name: 'Daftar Ulang', amount: daftarUlang }
        ];

        try {
          for (const bill of billings) {
            if (bill.amount > 0) {
              const status = isLunasFromSheet ? 'Lunas' : 'Belum';
              const periode = '2026-2027';

              await pool.execute(
                `INSERT INTO billing (nis, nama_santri, asrama, kamar, nama_tagihan, nominal, status, periode, source, kategori)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'google_sheet', ?)
                 ON DUPLICATE KEY UPDATE
                   nama_santri = VALUES(nama_santri),
                   asrama = VALUES(asrama),
                   kamar = VALUES(kamar),
                   nominal = VALUES(nominal),
                   status = VALUES(status),
                   source = 'google_sheet'`,
                [nis, nama, asrama, kamar || '-', bill.name, bill.amount, status, periode, kategori]
              );
            } else if (!isLunasFromSheet) {
              await pool.execute(
                `DELETE FROM billing WHERE nis = ? AND nama_tagihan = ? AND periode = ? AND status = 'Belum' AND kategori = ?`,
                [nis, bill.name, '2026-2027', kategori]
              );
            }
          }
          result.inserted++;
        } catch (err: any) {
          result.errors.push(`Sheet ${sheetName}, Baris ${i + 2}: ${err.message}`);
        }
      }
    }

    // Save sync log
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
      message: 'Sinkronisasi billing dari Google Sheets berhasil!',
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
      synced_at: nowStr
    });

  } catch (error: any) {
    console.error('Error Google Sheets Sync Billing:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal sinkronisasi billing: ' + error.message },
      { status: 500 }
    );
  }
}
