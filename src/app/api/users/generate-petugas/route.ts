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

    // Baca parameter force dari body (opsional) — jika true, akun yang sudah ada akan di-update (password direset)
    let force = false;
    try {
      const body = await request.json();
      force = !!body?.force;
    } catch (_) {}

    let createdCount = 0;
    let updatedCount = 0;
    const passwordHash = await bcrypt.hash('asrama123', 10);

    // ─── 1. Akun Petugas Umum (Shared / Default) ───────────────────────────
    const defaultPetugas = [
      { username: 'petugas_panggilan', nama: 'Petugas Pemanggilan Santri (Umum)', role: 'petugas_panggilan_umum' },
      { username: 'petugas_inventaris', nama: 'Petugas Inventaris (Umum)', role: 'petugas_inventaris_umum' },
      { username: 'petugas_kebersihan', nama: 'Petugas Kebersihan (Umum)', role: 'petugas_kebersihan_umum' },
      { username: 'petugas_umum', nama: 'Petugas Umum', role: 'petugas_umum' },
    ];

    for (const acc of defaultPetugas) {
      try {
        if (force) {
          // ON DUPLICATE KEY UPDATE: affectedRows=1 = INSERT baru, affectedRows=2 = UPDATE existing
          const [result]: any = await pool.execute(
            `INSERT INTO users (username, password, role, nama)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE password = VALUES(password), nama = VALUES(nama), role = VALUES(role)`,
            [acc.username, passwordHash, acc.role, acc.nama]
          );
          if (result.affectedRows === 1) createdCount++;
          else if (result.affectedRows === 2) updatedCount++;
        } else {
          await pool.execute(
            `INSERT INTO users (username, password, role, nama) VALUES (?, ?, ?, ?)`,
            [acc.username, passwordHash, acc.role, acc.nama]
          );
          createdCount++;
        }
      } catch (e: any) {
        if (e.code !== 'ER_DUP_ENTRY') {
          console.error(`Gagal membuat akun ${acc.username}:`, e.message);
        }
      }
    }

    // ─── 2. Akun Petugas Khusus Per-Asrama ──────────────────────────────────
    // Ambil daftar nama_asrama unik dari tabel kamar
    const [asramaRows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT nama_asrama FROM kamar WHERE nama_asrama IS NOT NULL AND nama_asrama != '' ORDER BY nama_asrama ASC`
    );

    let listAsrama = asramaRows.map((r: any) => r.nama_asrama);
    if (listAsrama.length === 0) {
      // Fallback jika belum di-setup di tabel kamar
      listAsrama = ['Asrama A', 'Asrama B', 'Asrama C', 'Asrama D', 'Asrama E', 'Asrama F', 'Asrama Tahfid'];
    }

    for (const rawAsrama of listAsrama) {
      const namaAsrama = rawAsrama.startsWith('Asrama ') ? rawAsrama : `Asrama ${rawAsrama}`;
      const suffix = namaAsrama.replace(/^Asrama\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '_');

      const akuPerAsrama = [
        {
          username: `petugas_inventaris_asrama_${suffix}`,
          nama: `Petugas Inventaris ${namaAsrama}`,
          role: 'petugas_inventaris',
        },
        {
          username: `petugas_kebersihan_asrama_${suffix}`,
          nama: `Petugas Kebersihan ${namaAsrama}`,
          role: 'petugas_kebersihan',
        },
        {
          username: `petugas_panggilan_asrama_${suffix}`,
          nama: `Petugas Pemanggilan ${namaAsrama}`,
          role: 'petugas_panggilan',
        },
      ];

      for (const acc of akuPerAsrama) {
        try {
          if (force) {
            const [result]: any = await pool.execute(
              `INSERT INTO users (username, password, role, nama, asrama)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE password = VALUES(password), nama = VALUES(nama), role = VALUES(role), asrama = VALUES(asrama)`,
              [acc.username, passwordHash, acc.role, acc.nama, namaAsrama]
            );
            if (result.affectedRows === 1) createdCount++;
            else if (result.affectedRows === 2) updatedCount++;
          } else {
            await pool.execute(
              `INSERT INTO users (username, password, role, nama, asrama) VALUES (?, ?, ?, ?, ?)`,
              [acc.username, passwordHash, acc.role, acc.nama, namaAsrama]
            );
            createdCount++;
          }
        } catch (e: any) {
          if (e.code !== 'ER_DUP_ENTRY') {
            console.error(`Gagal membuat akun ${acc.username}:`, e.message);
          }
        }
      }
    }

    // Hitung total akun petugas yang ada di database saat ini
    const [totalRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM users WHERE role LIKE 'petugas%'`
    );
    const totalPetugas = totalRows[0]?.total || 0;

    let message = '';
    if (createdCount > 0 && updatedCount > 0) {
      message = `Berhasil membuat ${createdCount} akun baru dan memperbarui ${updatedCount} akun petugas (Inventaris, Kebersihan & Pemanggilan per asrama). Password default: asrama123`;
    } else if (createdCount > 0) {
      message = `Berhasil men-generate ${createdCount} akun petugas baru (Inventaris, Kebersihan & Pemanggilan per asrama). Password default: asrama123`;
    } else if (updatedCount > 0) {
      message = `Berhasil memperbarui ${updatedCount} akun petugas (password direset ke default). Total: ${totalPetugas} akun petugas aktif. Password default: asrama123`;
    } else {
      message = `Seluruh akun petugas sudah terdaftar di database (${totalPetugas} akun petugas aktif). Gunakan tombol "Generate Ulang" untuk mereset password. Password default: asrama123`;
    }

    return NextResponse.json({
      success: true,
      message,
      created: createdCount,
      updated: updatedCount,
      total: totalPetugas,
      asrama_count: listAsrama.length,
    });
  } catch (error: any) {
    console.error('Error API generate-petugas:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
