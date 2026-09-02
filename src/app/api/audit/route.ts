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
    try {
      const [guruList] = await pool.execute<RowDataPacket[]>(
        `SELECT g.guru_id, g.nip, g.nama, g.user_id, u.username, u.nama as user_nama
         FROM guru g
         LEFT JOIN users u ON g.user_id = u.id OR u.guru_id = g.guru_id`
      );
      for (const g of guruList) {
        if (g.nama) {
          const realName = g.nama.trim();
          if (g.nip) nameMap[String(g.nip).toLowerCase()] = realName;
          if (g.guru_id) {
            nameMap[String(g.guru_id).toLowerCase()] = realName;
            nameMap[`guru_${g.guru_id}`.toLowerCase()] = realName;
            nameMap[`g_${g.guru_id}`.toLowerCase()] = realName;
            const padded = String(g.guru_id).padStart(2, '0');
            nameMap[`guru_${padded}`.toLowerCase()] = realName;
          }
          if (g.user_id) {
            nameMap[String(g.user_id).toLowerCase()] = realName;
            nameMap[`user_${g.user_id}`.toLowerCase()] = realName;
            const hexId = Number(g.user_id).toString(16).toLowerCase();
            if (hexId && !nameMap[hexId]) nameMap[hexId] = realName;
          }
          if (g.username) {
            nameMap[String(g.username).toLowerCase()] = realName;
          }
        }
      }

      const [usersList] = await pool.execute<RowDataPacket[]>(
        `SELECT id, username, nama, role FROM users`
      );
      for (const u of usersList) {
        if (u.nama && u.nama.trim()) {
          const realName = u.nama.trim();
          if (u.username && !nameMap[String(u.username).toLowerCase()]) {
            nameMap[String(u.username).toLowerCase()] = realName;
          }
          if (u.id && !nameMap[String(u.id).toLowerCase()]) {
            nameMap[String(u.id).toLowerCase()] = realName;
            const hexUserId = Number(u.id).toString(16).toLowerCase();
            if (hexUserId && !nameMap[hexUserId]) nameMap[hexUserId] = realName;
          }
        }
      }
    } catch (e) {
      console.warn("Audit name map build error:", e);
    }

    const resolveNama = (raw: string, userId?: number | string) => {
      if (userId && nameMap[String(userId).toLowerCase()]) {
        return nameMap[String(userId).toLowerCase()];
      }
      if (!raw || raw.trim() === '') return '';
      const clean = raw.trim();
      const lower = clean.toLowerCase();

      if (lower === 'adm' || lower === 'admin' || lower === 'administrator') {
        return nameMap['admin'] || nameMap['adm'] || 'Administrator';
      }
      if (nameMap[lower]) return nameMap[lower];

      const numSuffixMatch = lower.match(/^[a-z_]*(\d+)$/);
      if (numSuffixMatch) {
        const num = numSuffixMatch[1];
        const numNoLeadingZero = String(parseInt(num, 10));
        if (nameMap[num]) return nameMap[num];
        if (nameMap[numNoLeadingZero]) return nameMap[numNoLeadingZero];
        if (nameMap[`guru_${numNoLeadingZero}`]) return nameMap[`guru_${numNoLeadingZero}`];
        if (nameMap[`guru_${num}`]) return nameMap[`guru_${num}`];
      }

      if (/^[0-9a-f]+$/i.test(lower) && lower.length >= 3) {
        const decFromHex = String(parseInt(lower, 16));
        if (nameMap[decFromHex]) return nameMap[decFromHex];
      }

      return clean;
    };

    const enrichedRows = rows.map((r: any) => ({
      ...r,
      nama_lengkap: resolveNama(r.user_nama, r.user_id),
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
