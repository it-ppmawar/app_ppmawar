import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

// Default accounts to seed — tanpa sidik jari (biometric tidak akan didaftarkan)
const DEFAULT_ACCOUNTS = [
  // Pengasuh Asrama A - F
  { username: 'pengasuh_a', nama: 'Pengasuh Asrama A', role: 'pengasuh', password: 'Ppmawar@A' },
  { username: 'pengasuh_b', nama: 'Pengasuh Asrama B', role: 'pengasuh', password: 'Ppmawar@B' },
  { username: 'pengasuh_c', nama: 'Pengasuh Asrama C', role: 'pengasuh', password: 'Ppmawar@C' },
  { username: 'pengasuh_d', nama: 'Pengasuh Asrama D', role: 'pengasuh', password: 'Ppmawar@D' },
  { username: 'pengasuh_e', nama: 'Pengasuh Asrama E', role: 'pengasuh', password: 'Ppmawar@E' },
  { username: 'pengasuh_f', nama: 'Pengasuh Asrama F', role: 'pengasuh', password: 'Ppmawar@F' },
  // Petugas
  { username: 'petugas',    nama: 'Petugas Umum',     role: 'petugas',   password: 'Ppmawar@Petugas' },
];

export async function GET() {
  const results: { username: string; status: string; password?: string }[] = [];

  for (const acc of DEFAULT_ACCOUNTS) {
    try {
      // Cek apakah username sudah ada
      const [existing]: any = await pool.execute(
        'SELECT id FROM users WHERE username = ?',
        [acc.username]
      );

      if (existing.length > 0) {
        results.push({ username: acc.username, status: 'sudah ada — dilewati' });
        continue;
      }

      // Hash password & insert
      const hashed = await bcrypt.hash(acc.password, 10);
      await pool.execute(
        'INSERT INTO users (username, password, role, nama, is_pengasuh) VALUES (?, ?, ?, ?, 0)',
        [acc.username, hashed, acc.role, acc.nama]
      );

      results.push({
        username: acc.username,
        status: '✅ berhasil dibuat',
        password: acc.password,  // tampilkan password default sekali saja
      });
    } catch (e: any) {
      results.push({ username: acc.username, status: '❌ error: ' + e.message });
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Seeding akun default selesai. Segera ubah password default melalui halaman Manajemen Pengguna.',
    results,
  });
}
