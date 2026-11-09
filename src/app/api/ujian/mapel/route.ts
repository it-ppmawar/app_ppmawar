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
    const kelasId = searchParams.get('kelas_id');

    let mapelRows: RowDataPacket[] = [];

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

      if (kelasId && kelasId !== 'SEMUA') {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT j.mata_pelajaran, COALESCE(k.kitab, '') as kitab
           FROM jadwal_madin j
           LEFT JOIN kurikulum_madin k ON LOWER(TRIM(j.mata_pelajaran)) = LOWER(TRIM(k.mata_pelajaran))
           WHERE j.guru_id = ? AND j.kelas_madin_id = ? AND j.mata_pelajaran IS NOT NULL AND TRIM(j.mata_pelajaran) != ''
           ORDER BY j.mata_pelajaran ASC`,
          [activeGuruId || 0, kelasId]
        );
        mapelRows = rows;
      }

      // Jika kosong atau tanpa filter kelas, ambil semua mapel guru dari jadwal
      if (mapelRows.length === 0 && activeGuruId) {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT j.mata_pelajaran, COALESCE(k.kitab, '') as kitab
           FROM jadwal_madin j
           LEFT JOIN kurikulum_madin k ON LOWER(TRIM(j.mata_pelajaran)) = LOWER(TRIM(k.mata_pelajaran))
           WHERE j.guru_id = ? AND j.mata_pelajaran IS NOT NULL AND TRIM(j.mata_pelajaran) != ''
           ORDER BY j.mata_pelajaran ASC`,
          [activeGuruId]
        );
        mapelRows = rows;
      }

      // Fallback jika guru belum memiliki jadwal terdaftar
      if (mapelRows.length === 0) {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT mata_pelajaran, COALESCE(kitab, '') as kitab
           FROM kurikulum_madin
           WHERE mata_pelajaran IS NOT NULL AND TRIM(mata_pelajaran) != ''
           ORDER BY mata_pelajaran ASC`
        );
        mapelRows = rows;
      }
    } else {
      // Role Admin, Staff, Pengasuh: Akses seluruh mapel kurikulum & jadwal
      if (kelasId && kelasId !== 'SEMUA') {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT j.mata_pelajaran, COALESCE(k.kitab, '') as kitab
           FROM jadwal_madin j
           LEFT JOIN kurikulum_madin k ON LOWER(TRIM(j.mata_pelajaran)) = LOWER(TRIM(k.mata_pelajaran))
           WHERE j.kelas_madin_id = ? AND j.mata_pelajaran IS NOT NULL AND TRIM(j.mata_pelajaran) != ''
           UNION
           SELECT DISTINCT mata_pelajaran, COALESCE(kitab, '') as kitab
           FROM kurikulum_madin
           WHERE mata_pelajaran IS NOT NULL AND TRIM(mata_pelajaran) != ''
           ORDER BY mata_pelajaran ASC`,
          [kelasId]
        );
        mapelRows = rows;
      } else {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT mata_pelajaran, COALESCE(kitab, '') as kitab
           FROM kurikulum_madin
           WHERE mata_pelajaran IS NOT NULL AND TRIM(mata_pelajaran) != ''
           UNION
           SELECT DISTINCT mata_pelajaran, '' as kitab
           FROM jadwal_madin
           WHERE mata_pelajaran IS NOT NULL AND TRIM(mata_pelajaran) != ''
           ORDER BY mata_pelajaran ASC`
        );
        mapelRows = rows;
      }
    }

    // Normalisasi dan hilangkan duplikasi nama mapel
    const uniqueMap = new Map<string, string>();
    for (const r of mapelRows) {
      const name = (r.mata_pelajaran || '').trim();
      if (!name) continue;
      const lower = name.toLowerCase();
      if (!uniqueMap.has(lower) || (!uniqueMap.get(lower) && r.kitab)) {
        uniqueMap.set(lower, r.kitab || '');
      }
    }

    const cleanMapelList = Array.from(uniqueMap.entries()).map(([_, kitab], idx) => {
      // Cari nama asli dengan kapitalisasi terbaik
      const matched = mapelRows.find((r) => (r.mata_pelajaran || '').trim().toLowerCase() === _);
      return {
        id: idx + 1,
        mata_pelajaran: matched ? matched.mata_pelajaran.trim() : _,
        kitab: kitab || '',
      };
    });

    return NextResponse.json({
      success: true,
      role: userRoleLower,
      total: cleanMapelList.length,
      mapel: cleanMapelList,
    });
  } catch (error: any) {
    console.error('Error in GET /api/ujian/mapel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
