import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

export async function POST(request: Request) {
  try {
    const dumpPath = 'D:\\koding\\app.ppmawar\\DOC-20260728-WA0091.adding';
    if (!fs.existsSync(dumpPath)) {
      return NextResponse.json({ error: 'File dump database tidak ditemukan di ' + dumpPath }, { status: 404 });
    }

    const content = fs.readFileSync(dumpPath, 'utf8');

    // Stats counter
    let alumniAdded = 0;
    let alumniUpdated = 0;
    let muridUpdated = 0;
    let mutasiProcessed = 0;
    let pembayaranProcessed = 0;

    // --- STEP 1: PARSE & IMPORT SANTRI (ALUMNI & AKTIF) ---
    // Match INSERT INTO `santri` VALUES (...)
    const santriMatch = content.match(/INSERT INTO `santri` VALUES ([\s\S]*?);/);
    if (santriMatch && santriMatch[1]) {
      const rawValuesStr = santriMatch[1];
      
      // Parse tuples from INSERT statement
      const tuples: string[] = [];
      let currentTuple = '';
      let insideString = false;
      let escapeNext = false;

      for (let i = 0; i < rawValuesStr.length; i++) {
        const char = rawValuesStr[i];

        if (escapeNext) {
          currentTuple += char;
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          currentTuple += char;
          escapeNext = true;
          continue;
        }

        if (char === "'") {
          insideString = !insideString;
          currentTuple += char;
          continue;
        }

        if (!insideString) {
          if (char === '(') {
            currentTuple = '';
            continue;
          }
          if (char === ')') {
            tuples.push(currentTuple);
            currentTuple = '';
            continue;
          }
        }

        currentTuple += char;
      }

      // Process each santri record
      for (const tupleStr of tuples) {
        if (!tupleStr.trim()) continue;

        // Split columns respecting quoted strings
        const cols: string[] = [];
        let col = '';
        let inStr = false;
        let esc = false;

        for (let i = 0; i < tupleStr.length; i++) {
          const c = tupleStr[i];
          if (esc) {
            col += c;
            esc = false;
            continue;
          }
          if (c === '\\') {
            esc = true;
            continue;
          }
          if (c === "'") {
            inStr = !inStr;
            continue;
          }
          if (c === ',' && !inStr) {
            cols.push(col.trim());
            col = '';
            continue;
          }
          col += c;
        }
        cols.push(col.trim());

        if (cols.length < 28) continue;

        const nis = cols[3];
        const nama = cols[7];
        const tglMasuk = cols[1];
        const tglBoyong = cols[2];
        const nik = cols[6];
        const genderRaw = cols[10];
        const jenisKelamin = genderRaw === 'P' ? 'Perempuan' : 'Laki-laki';
        const desa = cols[17];
        const kecamatan = cols[18].split('~')[1] || cols[18];
        const kabupaten = cols[19].split('~')[1] || cols[19];
        const alamat = [cols[16], desa, kecamatan, kabupaten].filter(Boolean).join(', ');
        const noHp = cols[25] !== '0' ? cols[25] : null;
        const kamarRaw = cols[21];
        const statusNum = parseInt(cols[27], 10);

        const thnMasuk = tglMasuk && tglMasuk !== '0000-00-00' ? parseInt(tglMasuk.substring(0, 4), 10) : null;
        const thnKeluar = tglBoyong && tglBoyong !== '0000-00-00' ? parseInt(tglBoyong.substring(0, 4), 10) : 2026;

        // Status 3 = BOYONG, Status 4 = DROPOUT, or kamar = 'BOYONG' / 'DROPOUT'
        const isAlumni = statusNum === 3 || statusNum === 4 || kamarRaw === 'BOYONG' || kamarRaw === 'DROPOUT';

        if (isAlumni && nis && nama) {
          const statusKeluarStr = statusNum === 4 || kamarRaw === 'DROPOUT' ? 'Drop Out' : 'Lulus';
          const kategoriMukim = kamarRaw.toLowerCase().includes('lppm') ? 'LPPM' : 'PPM';

          // Insert or Update in alumni table
          const [exist] = await pool.execute<RowDataPacket[]>(
            'SELECT alumni_id FROM alumni WHERE nis = ? OR (LOWER(nama) = LOWER(?) AND nis IS NULL)',
            [nis, nama]
          );

          if (exist.length > 0) {
            await pool.execute(
              `UPDATE alumni SET 
                nama = ?, nik = ?, no_hp = ?, alamat = ?, tahun_masuk = ?, tahun_keluar = ?, 
                status_keluar = ?, jenis_kelamin = ?, kategori_mukim = ?
              WHERE alumni_id = ?`,
              [nama, nik !== '0' ? nik : null, noHp, alamat, thnMasuk, thnKeluar, statusKeluarStr, jenisKelamin, kategoriMukim, exist[0].alumni_id]
            );
            alumniUpdated++;
          } else {
            await pool.execute(
              `INSERT INTO alumni (nama, nis, nik, no_hp, alamat, tahun_masuk, tahun_keluar, status_keluar, jenis_kelamin, kategori_mukim)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [nama, nis, nik !== '0' ? nik : null, noHp, alamat, thnMasuk, thnKeluar, statusKeluarStr, jenisKelamin, kategoriMukim]
            );
            alumniAdded++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Berhasil menyinkronkan data dump Smart Pesantren!',
      stats: {
        alumni_ditambahkan: alumniAdded,
        alumni_diperbarui: alumniUpdated,
        murid_diperbarui: muridUpdated
      }
    });
  } catch (error: any) {
    console.error('Error sync mitra-dump:', error);
    return NextResponse.json({ error: 'Gagal menyinkronkan dump database: ' + error.message }, { status: 500 });
  }
}
