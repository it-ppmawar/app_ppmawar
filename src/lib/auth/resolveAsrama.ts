import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

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
  // staff_asrama_a, ketua_asrama_a, pengurus_asrama_a, pengasuh_a, petugas_inventaris_asrama_a, petugas_kebersihan_asrama_a, dll.
  const usernameMatch = username.match(/(?:asrama|pengasuh|petugas|petugas_inventaris|petugas_kebersihan)[_\-\s]+(?:asrama[_\-\s]+)?([a-f])(?:[_\-\s]|$)/i);
  if (usernameMatch) {
    return `Asrama ${usernameMatch[1].toUpperCase()}`;
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
