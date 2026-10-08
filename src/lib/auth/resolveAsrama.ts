import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * Menentukan wilayah (putra/putri) untuk user dengan role 'staff'.
 * Mengembalikan 'putra', 'putri', atau null (jika staff umum / admin akses penuh).
 *
 * Rumus identik dengan yang digunakan di halaman Data Santri dan Kelas:
 * - Putra: kata 'putra', 'asrama a', atau kode 'a'
 * - Putri: kata 'putri', 'asrama b'..'asrama f', kode 'b'..'f', atau 'tahfid'
 * - Semua / kosong: null (akses penuh)
 */
export async function resolveStaffWilayah(
  userId: number,
  role: string,
  username: string,
  tokenAsrama: string | null
): Promise<'putra' | 'putri' | null> {
  if (role !== 'staff') return null;

  const checkStr = (val: string | null): 'putra' | 'putri' | 'semua' | null => {
    if (!val) return null;
    const v = val.toLowerCase().trim();
    if (v === 'semua') return 'semua';
    if (v === 'putra' || v.includes('putra') || v.includes('asrama a') || v === 'a') return 'putra';
    if (
      v === 'putri' ||
      v.includes('putri') ||
      v.includes('asrama b') ||
      v.includes('asrama c') ||
      v.includes('asrama d') ||
      v.includes('asrama e') ||
      v.includes('asrama f') ||
      ['b', 'c', 'd', 'e', 'f', 'tahfid'].includes(v)
    ) {
      return 'putri';
    }
    return null;
  };

  // 1. Cek dari tokenAsrama / payload JWT
  const fromToken = checkStr(tokenAsrama);
  if (fromToken === 'semua') return null;
  if (fromToken === 'putra' || fromToken === 'putri') return fromToken;

  // 2. Cek dari kolom `asrama` di tabel users
  try {
    const [uRows] = await pool.execute<RowDataPacket[]>(
      `SELECT asrama FROM users WHERE id = ? AND asrama IS NOT NULL AND asrama != '' LIMIT 1`,
      [userId]
    );
    if (uRows.length > 0 && uRows[0].asrama) {
      const fromDb = checkStr(uRows[0].asrama as string);
      if (fromDb === 'semua') return null;
      if (fromDb === 'putra' || fromDb === 'putri') return fromDb;
    }
  } catch (e) {}

  // 3. Tebak dari username
  const fromUser = checkStr(username);
  if (fromUser === 'putra' || fromUser === 'putri') return fromUser;

  return null;
}

/**
 * Standard Single Source of Truth untuk filter data per wilayah.
 * Memastikan semua modul (Absen, Jadwal, Inventaris, Kebersihan, Kupon Makan, Santri, Kelas)
 * menggunakan kriteria yang seragam dan konsisten.
 */
export function getStaffWilayahDetails(wilayah: 'putra' | 'putri' | null) {
  if (wilayah === 'putra') {
    return {
      isRestricted: true,
      wilayah: 'putra' as const,
      dorms: ['A'],
      asramaList: ['Asrama A', 'A'],
      genderList: ['Laki-laki', 'L'],
      kelasKeyword: 'putra',
      // Kondisi SQL seragam
      kamarCondition: "(k.nama_asrama = 'Asrama A' OR k.nama_asrama = 'A')",
      madinCondition: "LOWER(k.nama_kelas) LIKE '%putra%'",
      quranCondition: "LOWER(k.nama_kelas) LIKE '%putra%'",
      inventarisCondition: "(i.asrama = 'Asrama A' OR i.asrama = 'A')",
      kebersihanCondition: "(k.asrama = 'Asrama A' OR k.asrama = 'A')"
    };
  }
  if (wilayah === 'putri') {
    return {
      isRestricted: true,
      wilayah: 'putri' as const,
      dorms: ['B', 'C', 'D', 'E', 'F', 'Tahfid'],
      asramaList: ['Asrama B', 'B', 'Asrama C', 'C', 'Asrama D', 'D', 'Asrama E', 'E', 'Asrama F', 'F', 'Asrama Tahfid', 'Tahfid'],
      genderList: ['Perempuan', 'P'],
      kelasKeyword: 'putri',
      // Kondisi SQL seragam
      kamarCondition: "(k.nama_asrama != 'Asrama A' AND k.nama_asrama != 'A' AND k.nama_asrama IS NOT NULL AND k.nama_asrama != '')",
      madinCondition: "LOWER(k.nama_kelas) LIKE '%putri%'",
      quranCondition: "LOWER(k.nama_kelas) LIKE '%putri%'",
      inventarisCondition: "(i.asrama != 'Asrama A' AND i.asrama != 'A' AND i.asrama IS NOT NULL AND i.asrama != '')",
      kebersihanCondition: "(k.asrama != 'Asrama A' AND k.asrama != 'A' AND k.asrama IS NOT NULL AND k.asrama != '')"
    };
  }
  return {
    isRestricted: false,
    wilayah: null,
    dorms: ['A', 'B', 'C', 'D', 'E', 'F', 'Tahfid'],
    asramaList: ['Asrama A', 'A', 'Asrama B', 'B', 'Asrama C', 'C', 'Asrama D', 'D', 'Asrama E', 'E', 'Asrama F', 'F', 'Asrama Tahfid', 'Tahfid'],
    genderList: ['Laki-laki', 'L', 'Perempuan', 'P'],
    kelasKeyword: null,
    kamarCondition: '1=1',
    madinCondition: '1=1',
    quranCondition: '1=1',
    inventarisCondition: '1=1',
    kebersihanCondition: '1=1'
  };
}

export async function resolveAsrama(
  userId: number,
  role: string,
  username: string,
  tokenAsrama: string | null
): Promise<string | null> {
  if (tokenAsrama) {
    if (tokenAsrama.startsWith('Asrama ') || tokenAsrama === 'Semua') return tokenAsrama;
    return `Asrama ${tokenAsrama}`;
  }

  // Coba cari dari database users.asrama secara langsung
  try {
    const [uRows] = await pool.execute<RowDataPacket[]>(
      `SELECT asrama FROM users WHERE id = ? AND asrama IS NOT NULL AND asrama != '' LIMIT 1`,
      [userId]
    );
    if (uRows.length > 0 && uRows[0].asrama) {
      const val = uRows[0].asrama;
      if (val.startsWith('Asrama ') || val === 'Semua') return val;
      return `Asrama ${val}`;
    }
  } catch (e) {}

  // Coba cari dari database users -> kamar (relasi langsung)
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT k.nama_asrama FROM users u 
       JOIN kamar k ON u.kamar_id = k.kamar_id 
       WHERE u.id = ? AND k.nama_asrama IS NOT NULL AND k.nama_asrama != '' LIMIT 1`,
      [userId]
    );
    if (rows.length > 0 && rows[0].nama_asrama) {
      return rows[0].nama_asrama;
    }
  } catch (e) {}

  // Coba cari nama asrama dari nama user itu sendiri di tabel users
  try {
    const [userRows] = await pool.execute<RowDataPacket[]>(
      `SELECT nama FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (userRows.length > 0 && userRows[0].nama) {
      const namaUpper = userRows[0].nama.toLowerCase();
      if (namaUpper.includes('tahfid')) {
        return 'Asrama Tahfid';
      }
      // Cari pola 'Asrama X' dalam nama user (misalnya "Pengurus Asrama A")
      const namaMatch = (userRows[0].nama as string).match(/asrama\s+([a-z])/i);
      if (namaMatch) {
        return `Asrama ${namaMatch[1].toUpperCase()}`;
      }
    }
  } catch (e) {}

  if (username.toLowerCase().includes('tahfid')) {
    return 'Asrama Tahfid';
  }

  // Tebak dari username - pola yang lebih presisi:
  // staff_asrama_a, ketua_asrama_a, pengurus_asrama_a, pengasuh_a, petugas_panggilan_asrama_a, petugas_inventaris_asrama_a, petugas_kebersihan_asrama_a, dll.
  const usernameMatch = username.match(/(?:asrama|pengasuh|petugas|petugas_panggilan|petugas_inventaris|petugas_kebersihan)[_\-\s]+(?:asrama[_\-\s]+)?([a-z0-9]+)(?:[_\-\s]|$)/i);
  if (usernameMatch) {
    const code = usernameMatch[1].toUpperCase();
    if (code === 'TAHFID') return 'Asrama Tahfid';
    return `Asrama ${code}`;
  }

  // Tebak dari username pola staff_putra / staff_putri
  // Misal: staff_putra, staff_putri, staff_putra_2, staff_madin_putra, dll.
  const usernameLower = username.toLowerCase();
  if (/putra/.test(usernameLower) && !/putri/.test(usernameLower)) {
    return 'putra';
  }
  if (/putri/.test(usernameLower)) {
    return 'putri';
  }

  return null;
}
