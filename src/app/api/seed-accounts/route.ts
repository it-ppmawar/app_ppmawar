import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

// Default accounts to seed — tanpa sidik jari (biometric tidak akan didaftarkan)
const DEFAULT_ACCOUNTS = [
  // Pengasuh Asrama A - F
  { username: 'pengasuh_a', nama: 'Pengasuh Asrama A', role: 'pengasuh', password: 'Ppmawar@AsramaA' },
  { username: 'pengasuh_b', nama: 'Pengasuh Asrama B', role: 'pengasuh', password: 'Ppmawar@AsramaB' },
  { username: 'pengasuh_c', nama: 'Pengasuh Asrama C', role: 'pengasuh', password: 'Ppmawar@AsramaC' },
  { username: 'pengasuh_d', nama: 'Pengasuh Asrama D', role: 'pengasuh', password: 'Ppmawar@AsramaD' },
  { username: 'pengasuh_e', nama: 'Pengasuh Asrama E', role: 'pengasuh', password: 'Ppmawar@AsramaE' },
  { username: 'pengasuh_f', nama: 'Pengasuh Asrama F', role: 'pengasuh', password: 'Ppmawar@AsramaF' },
  // Petugas Inventaris (Umum), Kebersihan (Umum) & Pemanggilan Santri (Umum)
  { username: 'petugas_inventaris', nama: 'Petugas Inventaris (Umum)', role: 'petugas_inventaris_umum', password: 'Ppmawar@Inventaris' },
  { username: 'petugas_kebersihan', nama: 'Petugas Kebersihan (Umum)', role: 'petugas_kebersihan_umum', password: 'Ppmawar@Kebersihan' },
  { username: 'petugas_panggilan', nama: 'Petugas Pemanggilan Santri (Umum)', role: 'petugas_panggilan_umum', password: 'Ppmawar@Panggilan' },
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
