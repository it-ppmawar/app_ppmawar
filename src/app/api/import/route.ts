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

    let result: { inserted: number; updated: number; skipped: number; errors: string[] };

    if (type === 'billing') {
      result = await importBilling(workbook);
    } else {
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
      case 'jurnal_madin':
        result = await importJurnal(dataRows, headers, 'madin', auth.userId);
        break;
      case 'jurnal_quran':
        result = await importJurnal(dataRows, headers, 'quran', auth.userId);
        break;
      case 'jurnal_kamar':
        result = await importJurnal(dataRows, headers, 'kamar', auth.userId);
        break;
      case 'jadwal_alumni':
        result = await importJadwalAlumni(dataRows, headers);
        break;
      case 'ketertiban':
        result = await importKetertiban(dataRows, headers);
        break;
      case 'kelas':
        result = await importKelas(dataRows, headers);
        break;
      case 'kelas_quran':
        result = await importKelas(dataRows, headers, 'quran');
        break;
      case 'kelas_madin':
        result = await importKelas(dataRows, headers, 'madin');
        break;
      case 'kamar':
        result = await importKamar(dataRows, headers);
        break;
      case 'users':
        result = await importUsers(dataRows, headers);
        break;
      case 'kurikulum':
        result = await importKurikulum(dataRows, headers);
        break;
      case 'inventaris':
        result = await importInventaris(dataRows, headers);
        break;
      case 'kebersihan':
        result = await importKebersihan(dataRows, headers);
        break;
      default:
        return NextResponse.json({ error: `Tipe impor "${type}" tidak valid` }, { status: 400 });
    }
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
  } else if (tipe === 'kegiatan' || tipe === 'kamar') {
    [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT kamar_id as id FROM kamar WHERE nama_kamar LIKE ? LIMIT 1', [`%${nama}%`]
    );
  }
  return rows.length > 0 ? rows[0].id : null;
}

// ─── IMPORT JURNAL ──────────────────────────────────────────────────────────
async function importJurnal(rows: any[][], headers: string[], tipe: 'madin' | 'quran' | 'kamar', userId: number) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colTanggal = findCol(headers, ['TANGGAL']);
  const colKelasKamar = findCol(headers, ['KELAS MADIN', 'KELAS QURAN', 'KAMAR', 'KELAS', 'NAMA KELAS', 'NAMA KAMAR']);
  const colMateri = findCol(headers, ['MATERI', 'MATERI PEMBELAJARAN', 'MATERI / KEGIATAN', 'KEGIATAN']);
  const colCatatan = findCol(headers, ['CATATAN']);
  const colKendala = findCol(headers, ['KENDALA']);

  if (colTanggal === -1 || colKelasKamar === -1 || colMateri === -1) {
    result.errors.push('Kolom wajib (TANGGAL, KELAS/KAMAR, MATERI) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tanggalRaw = row[colTanggal];
    let tanggal = '';
    
    // Handle excel date formatting if numeric
    if (tanggalRaw && !isNaN(Number(tanggalRaw)) && Number(tanggalRaw) > 20000) {
      // Excel serial date to YYYY-MM-DD
      const date = new Date(Math.round((Number(tanggalRaw) - 25569) * 86400 * 1000));
      tanggal = date.toISOString().split('T')[0];
    } else {
      tanggal = String(tanggalRaw || '').trim();
    }
    
    const kelasKamarNama = String(row[colKelasKamar] || '').trim();
    const materi = String(row[colMateri] || '').trim();
    if (!tanggal || !kelasKamarNama || !materi) { result.skipped++; continue; }

    const catatan = colCatatan !== -1 ? String(row[colCatatan] || '').trim() : '';
    const kendala = colKendala !== -1 ? String(row[colKendala] || '').trim() : '';

    try {
      const id = await resolveTempatId(tipe, kelasKamarNama);
      if (!id) {
        result.errors.push(`Baris ${i + 2}: Kelas/Kamar "${kelasKamarNama}" tidak ditemukan`);
        continue;
      }

      if (tipe === 'madin') {
        await pool.execute(
          `INSERT INTO jurnal_madin (tanggal, guru_id, kelas_id, materi, catatan, kendala) VALUES (?, ?, ?, ?, ?, ?)`,
          [tanggal, userId, id, materi, catatan, kendala || null]
        );
      } else if (tipe === 'quran') {
        await pool.execute(
          `INSERT INTO jurnal_quran (tanggal, guru_id, kelas_quran_id, materi, catatan, kendala) VALUES (?, ?, ?, ?, ?, ?)`,
          [tanggal, userId, id, materi, catatan, kendala || null]
        );
      } else {
        await pool.execute(
          `INSERT INTO jurnal_kamar (tanggal, pembina_id, kamar_id, kegiatan, catatan, kendala) VALUES (?, ?, ?, ?, ?, ?)`,
          [tanggal, userId, id, materi, catatan, kendala || null]
        );
      }
      result.inserted++;
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT JADWAL ALUMNI ───────────────────────────────────────────────────
async function importJadwalAlumni(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colJamMulai = findCol(headers, ['JAM MULAI', 'MULAI']);
  const colJamSelesai = findCol(headers, ['JAM SELESAI', 'SELESAI']);
  const colKegiatan = findCol(headers, ['KEGIATAN']);
  const colTempat = findCol(headers, ['TEMPAT']);
  const colKeterangan = findCol(headers, ['KETERANGAN']);

  if (colJamMulai === -1 || colKegiatan === -1) {
    result.errors.push('Kolom wajib (JAM MULAI, KEGIATAN) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const jamMulai = formatTime(row[colJamMulai]);
    const kegiatan = String(row[colKegiatan] || '').trim();
    if (!jamMulai || !kegiatan) { result.skipped++; continue; }

    const jamSelesai = colJamSelesai !== -1 ? formatTime(row[colJamSelesai]) : '00:00';
    const tempat = colTempat !== -1 ? String(row[colTempat] || '').trim() : '';
    const keterangan = colKeterangan !== -1 ? String(row[colKeterangan] || '').trim() : '';

    try {
      await pool.execute(
        `INSERT INTO jadwal_alumni (jam_mulai, jam_selesai, kegiatan, tempat, keterangan) VALUES (?, ?, ?, ?, ?)`,
        [jamMulai, jamSelesai, kegiatan, tempat || null, keterangan || null]
      );
      result.inserted++;
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT KETERTIBAN ──────────────────────────────────────────────────────
async function importKetertiban(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colNIS = findCol(headers, ['NIS']);
  const colTanggal = findCol(headers, ['TANGGAL']);
  const colJenis = findCol(headers, ['JENIS PELANGGARAN', 'JENIS', 'PELANGGARAN']);
  const colDeskripsi = findCol(headers, ['DESKRIPSI', 'KETERANGAN']);

  if (colNIS === -1 || colTanggal === -1 || colJenis === -1) {
    result.errors.push('Kolom wajib (NIS, TANGGAL, JENIS PELANGGARAN) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nis = String(row[colNIS] || '').trim();
    
    const tanggalRaw = row[colTanggal];
    let tanggal = '';
    if (tanggalRaw && !isNaN(Number(tanggalRaw)) && Number(tanggalRaw) > 20000) {
      const date = new Date(Math.round((Number(tanggalRaw) - 25569) * 86400 * 1000));
      tanggal = date.toISOString().split('T')[0];
    } else {
      tanggal = String(tanggalRaw || '').trim();
    }
    
    const jenis = String(row[colJenis] || '').trim();
    if (!nis || !tanggal || !jenis) { result.skipped++; continue; }

    const deskripsi = colDeskripsi !== -1 ? String(row[colDeskripsi] || '').trim() : '';

    try {
      const [muridRows] = await pool.execute<RowDataPacket[]>(
        'SELECT murid_id FROM murid WHERE nis = ? LIMIT 1', [nis]
      );
      if (muridRows.length === 0) {
        result.errors.push(`Baris ${i + 2}: Santri dengan NIS "${nis}" tidak ditemukan`);
        continue;
      }
      const muridId = muridRows[0].murid_id;

      await pool.execute(
        `INSERT INTO ketertiban (murid_id, jenis, deskripsi, tanggal) VALUES (?, ?, ?, ?)`,
        [muridId, jenis, deskripsi || null, tanggal]
      );
      result.inserted++;
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT KELAS ───────────────────────────────────────────────────────────
async function importKelas(rows: any[][], headers: string[], defaultType?: 'quran' | 'madin') {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colNamaKelas = findCol(headers, ['NAMA KELAS', 'KELAS']);
  const colTipe = findCol(headers, ['TIPE', 'JENIS']);
  const colWali = findCol(headers, ['WALI KELAS', 'PEMBINA', 'GURU']);

  if (colNamaKelas === -1 || (colTipe === -1 && !defaultType)) {
    result.errors.push(colTipe === -1 ? 'Kolom wajib (NAMA KELAS) tidak ditemukan' : 'Kolom wajib (NAMA KELAS, TIPE) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const namaKelas = String(row[colNamaKelas] || '').trim();
    const tipe = colTipe !== -1 ? String(row[colTipe] || '').trim().toLowerCase() : (defaultType || '');
    if (!namaKelas || !tipe) { result.skipped++; continue; }

    const waliIdentitas = colWali !== -1 ? String(row[colWali] || '').trim() : '';

    try {
      let guruId: number | null = null;
      if (waliIdentitas) {
        const [guruRows] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE nip = ? OR nama LIKE ? LIMIT 1',
          [waliIdentitas, `%${waliIdentitas}%`]
        );
        if (guruRows.length > 0) guruId = guruRows[0].guru_id;
      }

      if (tipe === 'madin') {
        const [existing] = await pool.execute<RowDataPacket[]>(
          'SELECT kelas_id FROM kelas_madin WHERE nama_kelas = ? LIMIT 1', [namaKelas]
        );
        if (existing.length > 0) {
          await pool.execute(
            'UPDATE kelas_madin SET guru_id = ? WHERE kelas_id = ?',
            [guruId, existing[0].kelas_id]
          );
          result.updated++;
        } else {
          await pool.execute(
            'INSERT INTO kelas_madin (nama_kelas, guru_id) VALUES (?, ?)',
            [namaKelas, guruId]
          );
          result.inserted++;
        }
      } else if (tipe === 'quran') {
        const [existing] = await pool.execute<RowDataPacket[]>(
          'SELECT id FROM kelas_quran WHERE nama_kelas = ? LIMIT 1', [namaKelas]
        );
        if (existing.length > 0) {
          await pool.execute(
            'UPDATE kelas_quran SET guru_id = ? WHERE id = ?',
            [guruId, existing[0].id]
          );
          result.updated++;
        } else {
          await pool.execute(
            'INSERT INTO kelas_quran (nama_kelas, guru_id) VALUES (?, ?)',
            [namaKelas, guruId]
          );
          result.inserted++;
        }
      } else {
        result.errors.push(`Baris ${i + 2}: Tipe kelas "${tipe}" tidak valid (harus "madin" atau "quran")`);
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT KAMAR ───────────────────────────────────────────────────────────
async function importKamar(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colNamaKamar = findCol(headers, ['NAMA KAMAR', 'KAMAR']);
  const colPembina = findCol(headers, ['PEMBINA', 'GURU']);

  if (colNamaKamar === -1) {
    result.errors.push('Kolom wajib (NAMA KAMAR) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const namaKamar = String(row[colNamaKamar] || '').trim();
    if (!namaKamar) { result.skipped++; continue; }

    const pembinaIdentitas = colPembina !== -1 ? String(row[colPembina] || '').trim() : '';

    try {
      let guruId: number | null = null;
      if (pembinaIdentitas) {
        const [guruRows] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id FROM guru WHERE nip = ? OR nama LIKE ? LIMIT 1',
          [pembinaIdentitas, `%${pembinaIdentitas}%`]
        );
        if (guruRows.length > 0) guruId = guruRows[0].guru_id;
      }

      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT kamar_id FROM kamar WHERE nama_kamar = ? LIMIT 1', [namaKamar]
      );

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE kamar SET guru_id = ? WHERE kamar_id = ?',
          [guruId, existing[0].kamar_id]
        );
        result.updated++;
      } else {
        await pool.execute(
          'INSERT INTO kamar (nama_kamar, guru_id) VALUES (?, ?)',
          [namaKamar, guruId]
        );
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT USERS ───────────────────────────────────────────────────────────
async function importUsers(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colUsername = findCol(headers, ['USERNAME']);
  const colNama = findCol(headers, ['NAMA']);
  const colRole = findCol(headers, ['ROLE']);
  const colPassword = findCol(headers, ['PASSWORD']);
  const colNipNis = findCol(headers, ['NIP / NIS', 'NIP', 'NIS']);

  if (colUsername === -1 || colRole === -1 || colPassword === -1) {
    result.errors.push('Kolom wajib (USERNAME, ROLE, PASSWORD) tidak ditemukan');
    return result;
  }

  const bcrypt = await import('bcryptjs');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const username = String(row[colUsername] || '').trim().toLowerCase();
    const roleVal = String(row[colRole] || '').trim().toLowerCase();
    const password = String(row[colPassword] || '').trim();
    if (!username || !roleVal || !password) { result.skipped++; continue; }

    const nama = colNama !== -1 ? String(row[colNama] || '').trim() : username;
    const nipNis = colNipNis !== -1 ? String(row[colNipNis] || '').trim() : '';

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE username = ? LIMIT 1', [username]
      );

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE users SET password = ?, role = ? WHERE id = ?',
          [hashedPassword, roleVal, existing[0].id]
        );
        result.updated++;
      } else {
        const [userRes] = await pool.execute<ResultSetHeader>(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, hashedPassword, roleVal]
        );
        const newUserId = userRes.insertId;

        if (nipNis) {
          if (roleVal === 'guru') {
            await pool.execute(
              'UPDATE guru SET user_id = ? WHERE nip = ? OR nama = ?',
              [newUserId, nipNis, nama]
            );
          } else if (roleVal === 'wali_murid') {
            await pool.execute(
              'UPDATE murid SET user_id = ? WHERE nis = ? OR nama = ?',
              [newUserId, nipNis, nama]
            );
          }
        }
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT BILLING (Excel Billing) ──────────────────────────────────────────
async function importBilling(workbook: XLSX.WorkBook) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const sheetName of workbook.SheetNames) {
    const cleanSheetName = sheetName.trim().toUpperCase();
    let kategori: 'pesantren' | 'madrasah' = 'pesantren';

    if (/^(ASRAMA\s+)?[A-F]$/i.test(cleanSheetName)) {
      // Sheet huruf tunggal A-F atau "ASRAMA A" dst. = tagihan pesantren
      kategori = 'pesantren';
    } else if (/KELAS\s*\d|^(IX|XII|XI|X)\s|MTS-|SMP-|MA-|SMK-|^\d+\s*(MTS|SMP|MA|SMK)/i.test(cleanSheetName)) {
      // Sheet seperti "KELAS 9 MTS", "XII MA", "XII SMK", "KELAS 9 SMP" = tagihan madrasah
      kategori = 'madrasah';
    } else {
      // Lewati sheet yang tidak relevan (seperti TEXTVALUE, Template WA, TOP 10, import1/2/3, Sheet1, Setting, dll.)
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

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

    // Resolve colStatus sekali per sheet (untuk file REKAP KELAS III)
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

      // Jika STATUS ADMINISTRASI = "Lunas" dan semua nominal 0, tetap import sebagai lunas
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
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'excel', ?)
               ON DUPLICATE KEY UPDATE
                 nama_santri = VALUES(nama_santri),
                 asrama = VALUES(asrama),
                 kamar = VALUES(kamar),
                 nominal = VALUES(nominal),
                 status = VALUES(status),
                 source = 'excel'`,
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

  return result;
}

// ─── IMPORT KURIKULUM ───────────────────────────────────────────────────────────
async function importKurikulum(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colTingkat = findCol(headers, ['TINGKATAN', 'TINGKAT', 'LEVEL']);
  const colMapel = findCol(headers, ['MATA PELAJARAN', 'MAPEL']);
  const colKitab = findCol(headers, ['JENJANG KITAB', 'KITAB', 'BUKU']);
  const colKeterangan = findCol(headers, ['KETERANGAN', 'CATATAN']);

  if (colTingkat === -1 || colMapel === -1 || colKitab === -1) {
    result.errors.push('Kolom wajib (TINGKATAN, MATA PELAJARAN, JENJANG KITAB) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tingkat = String(row[colTingkat] || '').trim().toUpperCase();
    const mapel = String(row[colMapel] || '').trim();
    const kitab = String(row[colKitab] || '').trim();
    const keterangan = colKeterangan !== -1 ? String(row[colKeterangan] || '').trim() : '';

    if (!tingkat || !mapel || !kitab) { result.skipped++; continue; }

    try {
      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM kurikulum_madin WHERE tingkat = ? AND mata_pelajaran = ? LIMIT 1',
        [tingkat, mapel]
      );

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE kurikulum_madin SET kitab = ?, keterangan = ? WHERE id = ?',
          [kitab, keterangan || null, existing[0].id]
        );
        result.updated++;
      } else {
        await pool.execute(
          'INSERT INTO kurikulum_madin (tingkat, mata_pelajaran, kitab, keterangan) VALUES (?, ?, ?, ?)',
          [tingkat, mapel, kitab, keterangan || null]
        );
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT INVENTARIS ────────────────────────────────────────────────────────
async function importInventaris(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colNama = findCol(headers, ['NAMA BARANG', 'NAMA', 'BARANG']);
  const colKategori = findCol(headers, ['KATEGORI']);
  const colAsrama = findCol(headers, ['ASRAMA']);
  const colJumlah = findCol(headers, ['JUMLAH', 'JML', 'QTY']);
  const colKondisi = findCol(headers, ['KONDISI']);
  const colKeterangan = findCol(headers, ['KETERANGAN', 'CATATAN']);

  if (colNama === -1 || colKategori === -1 || colAsrama === -1) {
    result.errors.push('Kolom wajib (NAMA BARANG, KATEGORI, ASRAMA) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nama = String(row[colNama] || '').trim();
    const kategori = String(row[colKategori] || '').trim().toLowerCase();
    const asrama = String(row[colAsrama] || '').trim();
    
    if (!nama || !kategori || !asrama) { result.skipped++; continue; }

    const jumlah = colJumlah !== -1 ? Number(row[colJumlah] || 1) : 1;
    let kondisi = colKondisi !== -1 ? String(row[colKondisi] || 'Baik').trim() : 'Baik';
    if (!['Baik', 'Rusak Ringan', 'Rusak Berat'].includes(kondisi)) kondisi = 'Baik';
    const keterangan = colKeterangan !== -1 ? String(row[colKeterangan] || '').trim() : '';

    try {
      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM inventaris WHERE nama_barang = ? AND asrama = ? LIMIT 1',
        [nama, asrama]
      );

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE inventaris SET kategori = ?, jumlah = ?, kondisi = ?, keterangan = ? WHERE id = ?',
          [kategori, jumlah, kondisi, keterangan || null, existing[0].id]
        );
        result.updated++;
      } else {
        await pool.execute(
          'INSERT INTO inventaris (nama_barang, kategori, asrama, jumlah, kondisi, keterangan) VALUES (?, ?, ?, ?, ?, ?)',
          [nama, kategori, asrama, jumlah, kondisi, keterangan || null]
        );
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}

// ─── IMPORT KEBERSIHAN ────────────────────────────────────────────────────────
async function importKebersihan(rows: any[][], headers: string[]) {
  const result = { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const colNama = findCol(headers, ['NAMA ITEM', 'NAMA', 'ITEM']);
  const colKategori = findCol(headers, ['KATEGORI']);
  const colAsrama = findCol(headers, ['ASRAMA']);
  const colJumlah = findCol(headers, ['JUMLAH', 'JML', 'QTY']);
  const colKondisi = findCol(headers, ['KONDISI']);
  const colKeterangan = findCol(headers, ['KETERANGAN', 'CATATAN']);

  if (colNama === -1 || colKategori === -1 || colAsrama === -1) {
    result.errors.push('Kolom wajib (NAMA ITEM, KATEGORI, ASRAMA) tidak ditemukan');
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nama = String(row[colNama] || '').trim();
    const kategori = String(row[colKategori] || '').trim().toLowerCase();
    const asrama = String(row[colAsrama] || '').trim();
    
    if (!nama || !kategori || !asrama) { result.skipped++; continue; }

    const jumlah = colJumlah !== -1 ? Number(row[colJumlah] || 1) : 1;
    let kondisi = colKondisi !== -1 ? String(row[colKondisi] || 'Bersih').trim() : 'Bersih';
    if (!['Bersih', 'Kotor Ringan', 'Kotor Berat'].includes(kondisi)) kondisi = 'Bersih';
    const keterangan = colKeterangan !== -1 ? String(row[colKeterangan] || '').trim() : '';

    try {
      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM kebersihan WHERE nama_item = ? AND asrama = ? LIMIT 1',
        [nama, asrama]
      );

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE kebersihan SET kategori = ?, jumlah = ?, kondisi = ?, keterangan = ? WHERE id = ?',
          [kategori, jumlah, kondisi, keterangan || null, existing[0].id]
        );
        result.updated++;
      } else {
        await pool.execute(
          'INSERT INTO kebersihan (nama_item, kategori, asrama, jumlah, kondisi, keterangan) VALUES (?, ?, ?, ?, ?, ?)',
          [nama, kategori, asrama, jumlah, kondisi, keterangan || null]
        );
        result.inserted++;
      }
    } catch (err: any) {
      result.errors.push(`Baris ${i + 2}: ${err.message}`);
    }
  }
  return result;
}


