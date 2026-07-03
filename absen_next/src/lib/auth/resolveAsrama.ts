import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function resolveAsrama(
  userId: number,
  role: string,
  username: string,
  tokenAsrama: string | null
): Promise<string | null> {
  if (tokenAsrama) return tokenAsrama;

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
      // Cari pola 'Asrama X' dalam nama user (misalnya "Pengurus Asrama A")
      const namaMatch = (userRows[0].nama as string).match(/asrama\s+([a-z])/i);
      if (namaMatch) {
        return `Asrama ${namaMatch[1].toUpperCase()}`;
      }
    }
  } catch (e) {}

  // Tebak dari username - pola yang lebih luas:
  // staff_asrama_a, ketua_asrama_a, pengurus_asrama_a, pengasuh_a, asrama_a, asrama-a, dll.
  // Cocokkan: kata "asrama" atau "pengasuh" diikuti separator opsional dan huruf a-f
  const usernameMatch = username.match(/(?:asrama|pengasuh)[_\-\s]?([a-f])(?:[_\-\s]|$)/i);
  if (usernameMatch) {
    return `Asrama ${usernameMatch[1].toUpperCase()}`;
  }

  // Tebak dari huruf di akhir username jika mengandung kata "asrama" atau "pengasuh" di mana saja
  const anyMatch = username.match(/(?:asrama|pengasuh).*?([a-f])(?:\b|_|$)/i);
  if (anyMatch) {
    return `Asrama ${anyMatch[1].toUpperCase()}`;
  }

  return null;
}
