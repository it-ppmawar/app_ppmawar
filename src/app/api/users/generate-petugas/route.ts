import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUserColumns } from '@/lib/ensureColumns';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureUserColumns();

    // Ambil daftar nama_asrama unik dari tabel kamar
    const [asramaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT nama_asrama FROM kamar WHERE nama_asrama IS NOT NULL AND nama_asrama != '' ORDER BY nama_asrama ASC`
    );

    let listAsrama = asramaRows.map((r: any) => r.nama_asrama);
    if (listAsrama.length === 0) {
      // Fallback jika belum di-setup di tabel kamar
      listAsrama = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F', 'Asrama Tahfid'];
    }

    let createdCount = 0;
    const passwordHash = await bcrypt.hash('asrama123', 10);

    for (const rawAsrama of listAsrama) {
      const namaAsrama = rawAsrama.startsWith('Asrama ') ? rawAsrama : `Asrama ${rawAsrama}`;
      const suffix = namaAsrama.replace(/^Asrama\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '_');

      // 1. Petugas Inventaris Asrama
      const usernameInv = `petugas_inventaris_asrama_${suffix}`;
      const namaInv = `Petugas Inventaris ${namaAsrama}`;

      try {
        await pool.execute(
          `INSERT INTO users (username, password, role, nama, asrama) VALUES (?, ?, 'petugas_inventaris', ?, ?)`,
          [usernameInv, passwordHash, namaInv, namaAsrama]
        );
        createdCount++;
      } catch (e: any) {
        if (e.code !== 'ER_DUP_ENTRY') {
          console.error(`Gagal membuat akun ${usernameInv}:`, e.message);
        }
      }

      // 2. Petugas Kebersihan Asrama
      const usernameKeb = `petugas_kebersihan_asrama_${suffix}`;
      const namaKeb = `Petugas Kebersihan ${namaAsrama}`;

      try {
        await pool.execute(
          `INSERT INTO users (username, password, role, nama, asrama) VALUES (?, ?, 'petugas_kebersihan', ?, ?)`,
          [usernameKeb, passwordHash, namaKeb, namaAsrama]
        );
        createdCount++;
      } catch (e: any) {
        if (e.code !== 'ER_DUP_ENTRY') {
          console.error(`Gagal membuat akun ${usernameKeb}:`, e.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil men-generate ${createdCount} akun petugas khusus asrama (Inventaris & Kebersihan). Password default: asrama123`
    });
  } catch (error: any) {
    console.error('Error API generate-petugas:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
