import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya Admin Utama yang dapat melihat audit log' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const aksi = searchParams.get('aksi') || '';
    const tabel = searchParams.get('tabel') || '';
    const user_id = searchParams.get('user_id') || '';
    const tanggal = searchParams.get('tanggal') || ''; // YYYY-MM-DD
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (aksi) { where += ' AND aksi = ?'; params.push(aksi); }
    if (tabel) { where += ' AND tabel = ?'; params.push(tabel); }
    if (user_id) { where += ' AND user_id = ?'; params.push(parseInt(user_id)); }
    if (tanggal) { where += ' AND DATE(created_at) = ?'; params.push(tanggal); }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, user_id, user_nama, user_role, aksi, tabel, record_id, keterangan,
              data_lama, data_baru, ip_address, created_at
       FROM audit_log ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Mapping nama asli guru dan user
    const nameMap: Record<string, string> = {};
    const jadwalGuruMap: Record<string, string> = {};

    try {
      // 1. Ambil seluruh data guru
      const [guruList] = await pool.query<RowDataPacket[]>(
        `SELECT guru_id, nip, nama, user_id FROM guru WHERE nama IS NOT NULL`
      );
      for (const g of guruList) {
        if (g.nama && g.nama.trim()) {
          const realName = g.nama.trim();
          if (g.guru_id) {
            const gId = String(g.guru_id).toLowerCase();
            nameMap[gId] = realName;
            nameMap[`guru_${gId}`] = realName;
            nameMap[`g_${gId}`] = realName;
            const padded = gId.padStart(2, '0');
            nameMap[`guru_${padded}`] = realName;
          }
          if (g.nip) {
            const nipStr = String(g.nip).trim().toLowerCase();
            nameMap[nipStr] = realName;
            nameMap[`guru_${nipStr}`] = realName;
            const numOnly = nipStr.replace(/\D/g, '');
            if (numOnly) {
              nameMap[numOnly] = realName;
              nameMap[`guru_${numOnly}`] = realName;
              const numInt = String(parseInt(numOnly, 10));
              nameMap[numInt] = realName;
              nameMap[`guru_${numInt}`] = realName;
            }
          }
          if (g.user_id) {
            const uId = String(g.user_id).toLowerCase();
            nameMap[uId] = realName;
            nameMap[`user_${uId}`] = realName;
            nameMap[`guru_${uId}`] = realName;
          }
        }
      }

      // 2. Ambil seluruh data users
      const [usersList] = await pool.query<RowDataPacket[]>(
        `SELECT id, username, nama, role FROM users`
      );
      for (const u of usersList) {
        const uName = (u.nama || '').trim();
        if (u.username) {
          const uname = String(u.username).trim().toLowerCase();
          if (uName && !nameMap[uname]) {
            nameMap[uname] = uName;
          }
        }
        if (u.id) {
          const uid = String(u.id);
          if (uName && !nameMap[uid]) {
            nameMap[uid] = uName;
          }
        }
      }

      // 3. Ambil mapping jadwal ke guru pengajar (untuk simpan_absen)
      const [madinJadwal] = await pool.query<RowDataPacket[]>(
        `SELECT j.jadwal_id, g.nama FROM jadwal_madin j JOIN guru g ON j.guru_id = g.guru_id WHERE g.nama IS NOT NULL`
      );
      madinJadwal.forEach((r: any) => { if (r.nama) jadwalGuruMap[`absensi_${r.jadwal_id}`] = r.nama.trim(); });

      const [quranJadwal] = await pool.query<RowDataPacket[]>(
        `SELECT j.id, g.nama FROM jadwal_quran j JOIN guru g ON j.guru_id = g.guru_id WHERE g.nama IS NOT NULL`
      );
      quranJadwal.forEach((r: any) => { if (r.nama) jadwalGuruMap[`absensi_quran_${r.id}`] = r.nama.trim(); });

      const [kegiatanJadwal] = await pool.query<RowDataPacket[]>(
        `SELECT j.kegiatan_id, g.nama FROM jadwal_kegiatan j JOIN guru g ON j.guru_id = g.guru_id WHERE g.nama IS NOT NULL`
      );
      kegiatanJadwal.forEach((r: any) => { if (r.nama) jadwalGuruMap[`absensi_kegiatan_${r.kegiatan_id}`] = r.nama.trim(); });

    } catch (e) {
      console.warn("Audit name map build error:", e);
    }

    const resolveNama = (raw: string, userId?: number | string, tabel?: string, recordId?: number | null) => {
      if (userId && nameMap[String(userId).toLowerCase()]) {
        return nameMap[String(userId).toLowerCase()];
      }
      if (!raw || raw.trim() === '') {
        if (tabel && recordId && jadwalGuruMap[`${tabel}_${recordId}`]) {
          return jadwalGuruMap[`${tabel}_${recordId}`];
        }
        return '';
      }
      const clean = raw.trim();
      const lower = clean.toLowerCase();

      if (lower === 'adm' || lower === 'admin' || lower === 'administrator') {
        return nameMap['admin'] || nameMap['adm'] || 'Administrator';
      }
      if (nameMap[lower]) return nameMap[lower];

      const numMatch = lower.match(/\d+/g);
      if (numMatch) {
        for (const num of numMatch) {
          const numNoZero = String(parseInt(num, 10));
          if (nameMap[`guru_${num}`]) return nameMap[`guru_${num}`];
          if (nameMap[`guru_${numNoZero}`]) return nameMap[`guru_${numNoZero}`];
          if (nameMap[num]) return nameMap[num];
          if (nameMap[numNoZero]) return nameMap[numNoZero];
          if (nameMap[`user_${num}`]) return nameMap[`user_${num}`];
        }
      }

      if (/^[0-9a-f]+$/i.test(lower) && lower.length >= 3) {
        const decFromHex = String(parseInt(lower, 16));
        if (nameMap[decFromHex]) return nameMap[decFromHex];
      }

      // Fallback ke guru dari jadwal jika aksi absensi
      if (tabel && recordId && jadwalGuruMap[`${tabel}_${recordId}`]) {
        return jadwalGuruMap[`${tabel}_${recordId}`];
      }

      return clean;
    };

    const enrichedRows = rows.map((r: any) => ({
      ...r,
      nama_lengkap: resolveNama(r.user_nama, r.user_id, r.tabel, r.record_id),
    }));

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_log ${where}`,
      params
    );

    return NextResponse.json({
      success: true,
      data: enrichedRows,
      total: countRows[0]?.total || 0,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
