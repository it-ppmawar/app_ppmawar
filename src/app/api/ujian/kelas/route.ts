import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, userId } = payload;
    const userRoleLower = (role || '').toLowerCase();

    const { searchParams } = new URL(request.url);
    const mapel = searchParams.get('mata_pelajaran')?.trim();

    let kelasRows: RowDataPacket[] = [];

    if (userRoleLower === 'guru') {
      let activeGuruId = guruId;
      if (!activeGuruId && userId) {
        try {
          const [gRows] = await pool.execute<RowDataPacket[]>(
            'SELECT guru_id FROM guru WHERE user_id = ? LIMIT 1',
            [userId]
          );
          if (gRows.length > 0) activeGuruId = gRows[0].guru_id;
        } catch (e) {}
      }

      if (mapel) {
        // Ambil kelas yang diajar oleh guru ini KHUSUS untuk mata pelajaran tersebut
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT k.kelas_id, k.nama_kelas
           FROM jadwal_madin j
           JOIN kelas_madin k ON j.kelas_madin_id = k.kelas_id
           WHERE j.guru_id = ? AND LOWER(TRIM(j.mata_pelajaran)) = LOWER(TRIM(?))
           ORDER BY k.nama_kelas ASC`,
          [activeGuruId || 0, mapel]
        );
        kelasRows = rows;
      }

      // Jika tidak ada filter mapel atau hasil filter mapel kosong (misal mapel custom/baru)
      if (kelasRows.length === 0) {
        if (activeGuruId) {
          const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT DISTINCT k.kelas_id, k.nama_kelas
             FROM kelas_madin k
             WHERE k.kelas_id IN (SELECT DISTINCT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
                OR k.guru_id = ?
             ORDER BY k.nama_kelas ASC`,
            [activeGuruId, activeGuruId]
          );
          kelasRows = rows;
        }

        // Fallback jika guru belum terdaftar di jadwal madin manapun
        if (kelasRows.length === 0) {
          const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT kelas_id, nama_kelas FROM kelas_madin ORDER BY nama_kelas ASC`
          );
          kelasRows = rows;
        }
      }
    } else {
      // Role Admin, Staff, Pengasuh
      if (mapel) {
        // Ambil kelas yang memiliki jadwal mata pelajaran ini
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT k.kelas_id, k.nama_kelas
           FROM jadwal_madin j
           JOIN kelas_madin k ON j.kelas_madin_id = k.kelas_id
           WHERE LOWER(TRIM(j.mata_pelajaran)) = LOWER(TRIM(?))
           ORDER BY k.nama_kelas ASC`,
          [mapel]
        );
        kelasRows = rows;
      }

      // Jika mapel tidak diberikan atau tidak ada jadwal spesifik untuk mapel tersebut
      if (kelasRows.length === 0) {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT kelas_id, nama_kelas FROM kelas_madin ORDER BY nama_kelas ASC`
        );
        kelasRows = rows;
      }
    }

    // Format output konsisten
    const formatted = kelasRows.map((r) => ({
      kelas_id: r.kelas_id,
      id: r.kelas_id,
      nama_kelas: r.nama_kelas,
      nama: r.nama_kelas,
    }));

    return NextResponse.json({
      success: true,
      role: userRoleLower,
      total: formatted.length,
      kelas: formatted,
    });
  } catch (error: any) {
    console.error('Error in GET /api/ujian/kelas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
