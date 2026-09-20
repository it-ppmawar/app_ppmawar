import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

// PATCH /api/user/update-nama — update nama tampilan guru / user
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const userId = payload.userId || payload.id;
    if (!userId) return NextResponse.json({ error: 'User ID tidak ditemukan' }, { status: 400 });

    const body = await request.json();
    const { nama } = body;

    if (!nama || typeof nama !== 'string' || nama.trim().length < 2) {
      return NextResponse.json({ error: 'Nama tidak valid (minimal 2 karakter)' }, { status: 400 });
    }

    const newNama = nama.trim();

    // 1. Cari entitas guru terkait di tabel guru
    let targetGuruId: number | null = null;
    let oldGuruNama: string | null = null;

    // Prioritas 1: guru yang sudah terhubung dengan user_id ini
    try {
      const [byUserId] = await pool.execute<RowDataPacket[]>(
        'SELECT guru_id, nama FROM guru WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (byUserId.length > 0) {
        targetGuruId = byUserId[0].guru_id;
        oldGuruNama = byUserId[0].nama;
      }
    } catch (_) {}

    // Prioritas 2: via guruId di payload token
    if (!targetGuruId && payload.guruId) {
      try {
        const [byGuruId] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id, nama FROM guru WHERE guru_id = ? LIMIT 1',
          [payload.guruId]
        );
        if (byGuruId.length > 0) {
          targetGuruId = byGuruId[0].guru_id;
          oldGuruNama = byGuruId[0].nama;
        }
      } catch (_) {}
    }

    // Prioritas 3: via NIP akun user
    if (!targetGuruId && userId) {
      try {
        const [byNip] = await pool.execute<RowDataPacket[]>(
          'SELECT g.guru_id, g.nama FROM guru g JOIN users u ON (u.nip IS NOT NULL AND u.nip != "" AND g.nip = u.nip) WHERE u.id = ? LIMIT 1',
          [userId]
        );
        if (byNip.length > 0) {
          targetGuruId = byNip[0].guru_id;
          oldGuruNama = byNip[0].nama;
        }
      } catch (_) {}
    }

    // Prioritas 4: via username (misal '2026' + guru_id atau nip)
    if (!targetGuruId && payload.username) {
      try {
        const possibleGuruId = payload.username.startsWith('2026') ? payload.username.replace('2026', '') : payload.username;
        const [byUname] = await pool.execute<RowDataPacket[]>(
          'SELECT guru_id, nama FROM guru WHERE guru_id = ? OR nip = ? LIMIT 1',
          [possibleGuruId, payload.username]
        );
        if (byUname.length > 0) {
          targetGuruId = byUname[0].guru_id;
          oldGuruNama = byUname[0].nama;
        }
      } catch (_) {}
    }

    // Prioritas 5: via kecocokan nama akun login dengan nama guru
    if (!targetGuruId && userId) {
      try {
        const [byName] = await pool.execute<RowDataPacket[]>(
          'SELECT g.guru_id, g.nama FROM guru g JOIN users u ON LOWER(TRIM(g.nama)) = LOWER(TRIM(u.nama)) WHERE u.id = ? LIMIT 1',
          [userId]
        );
        if (byName.length > 0) {
          targetGuruId = byName[0].guru_id;
          oldGuruNama = byName[0].nama;
        }
      } catch (_) {}
    }

    // 2. Eksekusi update
    if (targetGuruId) {
      // Perbarui tabel guru saja (Data Guru & Pembina), tanpa menyentuh akun users
      await pool.execute(
        'UPDATE guru SET nama = ?, user_id = ? WHERE guru_id = ?',
        [newNama, userId, targetGuruId]
      );

      // Sinkronkan juga ke dewan_guru jika ada data terkait
      if (oldGuruNama) {
        try {
          await pool.execute(
            'UPDATE dewan_guru SET nama = ? WHERE LOWER(TRIM(nama)) = LOWER(TRIM(?))',
            [newNama, oldGuruNama]
          );
        } catch (_) {}
      }
    } else {
      // Fallback: Jika pengguna memang bukan dewan guru/pembina (misal akun murni admin/wali murid), perbarui users.nama
      await pool.execute(
        'UPDATE users SET nama = ? WHERE id = ?',
        [newNama, userId]
      );
    }

    return NextResponse.json({ success: true, message: 'Nama berhasil diperbarui', nama: newNama });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
