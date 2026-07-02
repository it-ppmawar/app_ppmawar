import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload) return null;
  return payload;
}

// POST: Import Excel data (guru, alumni, jadwal)
export async function POST(request: Request) {
  try {
    const auth = await getAuth();
    if (!auth || (auth.role !== 'admin' && auth.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff yang dapat mengimpor data' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file || !type) {
      return NextResponse.json({ error: 'File dan tipe impor harus disertakan' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rawData.length < 2) {
      return NextResponse.json({ error: 'File Excel kosong atau hanya berisi header' }, { status: 400 });
    }

    // Cari baris header (skip baris judul/subtitle jika ada)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
      const row = rawData[i];
      if (row && row.length >= 3) {
        const firstCell = String(row[0] || '').toUpperCase().trim();
        if (firstCell === 'NO' || firstCell === 'NIP' || firstCell === 'NAMA' || firstCell === 'NIS' || firstCell === 'HARI') {
          headerRowIndex = i;
          break;
        }
      }
    }

    const headers = rawData[headerRowIndex].map((h: any) => String(h || '').toUpperCase().trim());
    const dataRows = rawData.slice(headerRowIndex + 1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

    let result: { inserted: number; updated: number; skipped: number; errors: string[] };

    switch (type) {
      case 'guru':
        result = await importGuru(dataRows, headers);
        break;
      case 'alumni':
        result = await importAlumni(dataRows, headers);
        break;
      case 'jadwal_madin':
        result = await importJadwal(dataRows, headers, 'madin');
        break;
      case 'jadwal_quran':
        result = await importJadwal(dataRows, headers, 'quran');
        break;
      case 'jadwal_kegiatan':
        result = await importJadwal(dataRows, headers, 'kegiatan');
        break;
      default:
        return NextResponse.json({ error: `Tipe impor "${type}" tidak valid` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Impor selesai: ${result.inserted} ditambahkan, ${result.updated} diperbarui, ${result.skipped} dilewati.`,
      details: result
    });
  } catch (error: any) {
    console.error('Error POST /api/import:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

// ─── IMPORT GURU ────────────────────────────────────────────────────────────
async function importGuru(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  const colNIP = headers.indexOf('NIP');
  const colNama = findCol(headers, ['NAMA LENGKAP', 'NAMA']);
  const colJK = findCol(headers, ['JENIS KELAMIN', 'J. KELAMIN', 'JK', 'GENDER']);
  const colJabatan = findCol(headers, ['JABATAN', 'TUGAS']);
  const colHP = findCol(headers, ['NO HP', 'NO. HP', 'WHATSAPP', 'NO HP/WA', 'NO. WHATSAPP']);
  const colAlamat = findCol(headers, ['ALAMAT']);

  if (colNama === -1) {
    result.errors.push('Kolom "NAMA" tidak ditemukan dalam file Excel');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nama = String(row[colNama] || '').trim();
    if (!nama) { result.skipped++; continue; }

    const nip = colNIP !== -1 ? String(row[colNIP] || '').trim() : '';
    const jk = colJK !== -1 ? String(row[colJK] || '').trim() : '';
    const jabatan = colJabatan !== -1 ? String(row[colJabatan] || '').trim() : '';
    const hp = colHP !== -1 ? String(row[colHP] || '').trim() : '';
    const alamat = colAlamat !== -1 ? String(row[colAlamat] || '').trim() : '';

    try {
      // Cek duplikasi berdasarkan NIP (jika ada) atau nama
      let existing: RowDataPacket[] = [];
      if (nip) {
        [existing] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE nip = ? LIMIT 1', [nip]
        );
      }
      if (existing.length === 0) {
        [existing] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE nama = ? LIMIT 1', [nama]
        );
      }

      if (existing.length > 0) {
        // Update data yang sudah ada
        await pool.execute(
          `UPDATE guru SET nama = ?, nip = ?, jenis_kelamin = ?, jabatan = ?, no_hp = ?, alamat = ? WHERE guru_id = ?`,
          [nama, nip || null, jk || null, jabatan || null, hp || null, alamat || null, existing[0].guru_id]
        );
        result.updated++;
      } else {
        // Insert baru
        await pool.execute(
          `INSERT INTO guru (nama, nip, jenis_kelamin, jabatan, no_hp, alamat) VALUES (?, ?, ?, ?, ?, ?)`,
          [nama, nip || null, jk || null, jabatan || null, hp || null, alamat || null]
        );
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }

  return result;
}

// ─── IMPORT ALUMNI ──────────────────────────────────────────────────────────
async function importAlumni(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  const colNIS = findCol(headers, ['NIS']);
  const colNama = findCol(headers, ['NAMA LENGKAP', 'NAMA']);
  const colNIK = findCol(headers, ['NIK']);
  const colJK = findCol(headers, ['JENIS KELAMIN', 'J. KELAMIN', 'JK']);
  const colHP = findCol(headers, ['NO HP', 'NO. HP', 'WHATSAPP']);
  const colAlamat = findCol(headers, ['ALAMAT']);
  const colTahunMasuk = findCol(headers, ['TAHUN MASUK', 'THN MASUK']);
  const colTahunKeluar = findCol(headers, ['TAHUN KELUAR', 'THN KELUAR']);
  const colStatusKeluar = findCol(headers, ['STATUS KELUAR', 'STATUS']);
  const colKategori = findCol(headers, ['KATEGORI', 'KATEGORI MUKIM']);
  const colKeterangan = findCol(headers, ['KETERANGAN', 'RIWAYAT']);

  if (colNama === -1) {
    result.errors.push('Kolom "NAMA" tidak ditemukan dalam file Excel');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nama = String(row[colNama] || '').trim();
    if (!nama) { result.skipped++; continue; }

    const nis = colNIS !== -1 ? String(row[colNIS] || '').trim() : '';
    const nik = colNIK !== -1 ? String(row[colNIK] || '').trim() : '';
    const jk = colJK !== -1 ? String(row[colJK] || '').trim() : '';
    const hp = colHP !== -1 ? String(row[colHP] || '').trim() : '';
    const alamat = colAlamat !== -1 ? String(row[colAlamat] || '').trim() : '';
    const tahunMasuk = colTahunMasuk !== -1 ? row[colTahunMasuk] : null;
    const tahunKeluar = colTahunKeluar !== -1 ? row[colTahunKeluar] : null;
    const statusKeluar = colStatusKeluar !== -1 ? String(row[colStatusKeluar] || 'Lulus').trim() : 'Lulus';
    const kategori = colKategori !== -1 ? String(row[colKategori] || 'PPM').trim() : 'PPM';
    const keterangan = colKeterangan !== -1 ? String(row[colKeterangan] || '').trim() : '';

    try {
      let existing: RowDataPacket[] = [];
      if (nis) {
        [existing] = await pool.execute<RowDataPacket[]>(
          'SELECT alumni_id FROM alumni WHERE nis = ? LIMIT 1', [nis]
        );
      }
      if (existing.length === 0) {
        [existing] = await pool.execute<RowDataPacket[]>(
          'SELECT alumni_id FROM alumni WHERE nama = ? LIMIT 1', [nama]
        );
      }

      if (existing.length > 0) {
        await pool.execute(
          `UPDATE alumni SET nama = ?, nis = ?, nik = ?, jenis_kelamin = ?, no_hp = ?, alamat = ?, 
           tahun_masuk = ?, tahun_keluar = ?, status_keluar = ?, kategori_mukim = ?, keterangan = ? WHERE alumni_id = ?`,
          [nama, nis || null, nik || null, jk || null, hp || null, alamat || null,
           tahunMasuk || null, tahunKeluar || null, statusKeluar, kategori, keterangan || null, existing[0].alumni_id]
        );
        result.updated++;
      } else {
        await pool.execute(
          `INSERT INTO alumni (nama, nis, nik, jenis_kelamin, no_hp, alamat, tahun_masuk, tahun_keluar, status_keluar, kategori_mukim, keterangan) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [nama, nis || '', nik || null, jk || null, hp || null, alamat || null,
           tahunMasuk || null, tahunKeluar || null, statusKeluar, kategori, keterangan || null]
        );
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }

  return result;
}

// ─── IMPORT JADWAL ──────────────────────────────────────────────────────────
async function importJadwal(rows: any[][], headers: string[], tipe: 'madin' | 'quran' | 'kegiatan') {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  const colHari = findCol(headers, ['HARI']);
  const colJamMulai = findCol(headers, ['JAM MULAI', 'MULAI']);
  const colJamSelesai = findCol(headers, ['JAM SELESAI', 'SELESAI']);
  const colKegiatan = findCol(headers, ['KEGIATAN', 'MATA PELAJARAN', 'MAPEL', 'NAMA KEGIATAN']);
  const colTempat = findCol(headers, ['TEMPAT', 'KELAS', 'KAMAR', 'NAMA KELAS', 'NAMA KAMAR']);
  const colGuru = findCol(headers, ['GURU', 'NAMA GURU', 'PEMBINA']);

  if (colHari === -1 || colJamMulai === -1 || colKegiatan === -1) {
    result.errors.push('Kolom wajib (HARI, JAM MULAI, KEGIATAN) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hari = String(row[colHari] || '').trim();
    if (!hari) { result.skipped++; continue; }

    const jamMulai = formatTime(row[colJamMulai]);
    const jamSelesai = colJamSelesai !== -1 ? formatTime(row[colJamSelesai]) : '00:00';
    const kegiatan = String(row[colKegiatan] || '').trim();
    const tempatNama = colTempat !== -1 ? String(row[colTempat] || '').trim() : '';
    const guruNama = colGuru !== -1 ? String(row[colGuru] || '').trim() : '';

    if (!kegiatan) { result.skipped++; continue; }

    try {
      // Resolve tempat_id
      let tempatId: number | null = null;
      if (tempatNama) {
        tempatId = await resolveTempatId(tipe, tempatNama);
      }

      // Resolve guru_id
      let guruId: number | null = null;
      if (guruNama) {
        const [guruRows] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE nama LIKE ? LIMIT 1', [`%${guruNama}%`]
        );
        if (guruRows.length > 0) guruId = guruRows[0].guru_id;
      }

      // Cek duplikasi berdasarkan hari + jam + kegiatan + tempat
      let tableName = '', idCol = '', kegiatanCol = '', tempatCol = '';
      if (tipe === 'madin') {
        tableName = 'jadwal_madin'; idCol = 'jadwal_id'; kegiatanCol = 'mata_pelajaran'; tempatCol = 'kelas_madin_id';
      } else if (tipe === 'quran') {
        tableName = 'jadwal_quran'; idCol = 'id'; kegiatanCol = 'mata_pelajaran'; tempatCol = 'kelas_quran_id';
      } else {
        tableName = 'jadwal_kegiatan'; idCol = 'kegiatan_id'; kegiatanCol = 'nama_kegiatan'; tempatCol = 'kamar_id';
      }

      const [existing] = await pool.execute<RowDataPacket[]>(
        `SELECT ${idCol} as id FROM ${tableName} WHERE hari = ? AND jam_mulai = ? AND ${kegiatanCol} = ? LIMIT 1`,
        [hari, jamMulai, kegiatan]
      );

      if (existing.length > 0) {
        // Update existing
        const updates: string[] = [];
        const params: any[] = [];

        updates.push('jam_selesai = ?'); params.push(jamSelesai);
        if (guruId) { updates.push('guru_id = ?'); params.push(guruId); }
        if (tempatId) { updates.push(`${tempatCol} = ?`); params.push(tempatId); }
        params.push(existing[0].id);

        if (updates.length > 0) {
          await pool.execute(
            `UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${idCol} = ?`, params
          );
        }
        result.updated++;
      } else {
        // Insert baru
        await pool.execute(
          `INSERT INTO ${tableName} (hari, jam_mulai, jam_selesai, ${kegiatanCol}, ${tempatCol}, guru_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [hari, jamMulai, jamSelesai, kegiatan, tempatId, guruId]
        );
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }

  return result;
}

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

function findCol(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  // Partial match
  for (const alias of aliases) {
    const idx = headers.findIndex(h => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

function formatTime(value: any): string {
  if (value === null || value === undefined) return '00:00';
  const str = String(value).trim();
  // Jika format Excel number (fraction of day, e.g. 0.3333 = 08:00)
  if (!isNaN(Number(str)) && Number(str) < 1 && Number(str) > 0) {
    const totalMinutes = Math.round(Number(str) * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  // Jika sudah format HH:MM atau HH:MM:SS
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return str;
}

async function resolveTempatId(tipe: string, nama: string): Promise<number | null> {
  let rows: RowDataPacket[] = [];
  if (tipe === 'madin') {
    [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT kelas_id as id FROM kelas_madin WHERE nama_kelas LIKE ? LIMIT 1', [`%${nama}%`]
    );
  } else if (tipe === 'quran') {
    [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM kelas_quran WHERE nama_kelas LIKE ? LIMIT 1', [`%${nama}%`]
    );
  } else if (tipe === 'kegiatan') {
    [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT kamar_id as id FROM kamar WHERE nama_kamar LIKE ? LIMIT 1', [`%${nama}%`]
    );
  }
  return rows.length > 0 ? rows[0].id : null;
}
