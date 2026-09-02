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

    // Mapping nama asli guru dan user secara terisolasi agar tidak ada bentrok ID
    const guruById: Record<string, string> = {};
    const guruByNip: Record<string, string> = {};
    const userByUsername: Record<string, string> = {};
    const userById: Record<string, string> = {};
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
            guruById[gId] = realName;
            guruById[`guru_${gId}`] = realName;
            const padded = gId.padStart(2, '0');
            guruById[`guru_${padded}`] = realName;
          }
          if (g.nip) {
            const nipStr = String(g.nip).trim().toLowerCase();
            guruByNip[nipStr] = realName;
            guruByNip[`guru_${nipStr}`] = realName;
            const numOnly = nipStr.replace(/\D/g, '');
            if (numOnly) {
              guruByNip[numOnly] = realName;
              guruByNip[`guru_${numOnly}`] = realName;
              const numInt = String(parseInt(numOnly, 10));
              guruByNip[numInt] = realName;
              guruByNip[`guru_${numInt}`] = realName;
            }
          }
          if (g.user_id) {
            guruById[`user_${g.user_id}`] = realName;
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
          if (uName) userByUsername[uname] = uName;
        }
        if (u.id && uName) {
          userById[String(u.id)] = uName;
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

    const resolveNama = (raw: string, userId?: number | string, userRole?: string, tabel?: string, recordId?: number | null) => {
      const clean = (raw || '').trim();
      const lower = clean.toLowerCase();

      // 1. Akun Admin Utama atau role admin khusus
      if (lower === 'adm' || lower === 'admin' || lower === 'administrator' || userRole === 'admin') {
        if (userByUsername[lower] && userByUsername[lower].toLowerCase() !== 'adm') {
          return userByUsername[lower];
        }
        return 'Administrator';
      }

      // 2. Cek username persis di userByUsername (misal staff_putri, kepala_madin_putra, dll)
      if (userByUsername[lower]) {
        return userByUsername[lower];
      }

      // 3. Cek format guru_XX atau nip
      if (guruById[lower]) return guruById[lower];
      if (guruByNip[lower]) return guruByNip[lower];

      // 4. Ekstrak angka dari format 'guru_17', 'guru_04', 'guru27', dll
      const numMatch = lower.match(/\d+/g);
      if (numMatch) {
        for (const num of numMatch) {
          const numNoZero = String(parseInt(num, 10));
          if (guruById[num]) return guruById[num];
          if (guruById[numNoZero]) return guruById[numNoZero];
          if (guruById[`guru_${num}`]) return guruById[`guru_${num}`];
          if (guruById[`guru_${numNoZero}`]) return guruById[`guru_${numNoZero}`];
          if (guruByNip[num]) return guruByNip[num];
          if (guruByNip[numNoZero]) return guruByNip[numNoZero];
        }
      }

      // 5. Cek dari ID user jika role guru
      if (userRole === 'guru' && userId && guruById[`user_${userId}`]) {
        return guruById[`user_${userId}`];
      }

      // 6. Fallback ke guru dari jadwal jika aksi absensi
      if (tabel && recordId && jadwalGuruMap[`${tabel}_${recordId}`]) {
        return jadwalGuruMap[`${tabel}_${recordId}`];
      }

      // 7. Cek userById jika ada nama di users
      if (userId && userById[String(userId)]) {
        return userById[String(userId)];
      }

      return clean || '—';
    };

    const enrichedRows = rows.map((r: any) => ({
      ...r,
      nama_lengkap: resolveNama(r.user_nama, r.user_id, r.user_role, r.tabel, r.record_id),
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
