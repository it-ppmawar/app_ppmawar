import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { resolveAsrama } from '@/lib/auth/resolveAsrama';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const userId = payload.userId || payload.id;
    const role = payload.role;
    const username = payload.username;

    // isPengasuhUser: hanya pengasuh (is_pengasuh=true) yang dapat akses billing
    // is_pengurus_asrama TIDAK termasuk karena pengurus_asrama tidak punya hak akses billing
    let isPengasuhUser = !!(payload.isPengasuh || payload.is_pengasuh || role === 'pengasuh');

    // Refresh dari DB agar selalu up-to-date (token mungkin dibuat sebelum flag set)
    if (userId) {
      try {
        const [uRows] = await pool.execute<RowDataPacket[]>('SELECT is_pengasuh FROM users WHERE id = ? LIMIT 1', [userId]);
        if (uRows.length > 0 && uRows[0].is_pengasuh) {
          isPengasuhUser = true;
        }
      } catch (_) {}
    }

    // pengurus_asrama TIDAK mendapat akses billing
    const allowedRoles = ['admin', 'staff', 'wali_murid', 'pengasuh'];
    if (!allowedRoles.includes(role) && !isPengasuhUser) {
      return NextResponse.json({ error: 'Akses ditolak: Peran Anda tidak memiliki izin mengakses info tagihan.' }, { status: 403 });
    }

    // JOIN dengan tabel murid untuk mendapatkan info nama_wali, no_wali/no_hp_wali, foto_url, alamat
    let query = `
      SELECT b.*, 
             m.nama_wali, 
             m.no_wali, 
             m.foto as foto_url, 
             m.alamat 
      FROM billing b
      LEFT JOIN murid m ON b.nis = m.nis
    `;
    let params: any[] = [];
    const conditions: string[] = [];

    // Parse query params
    const url = new URL(request.url);
    const kategoriFilter = url.searchParams.get('kategori'); // 'pesantren' | 'madrasah' | null
    const nisFilter = url.searchParams.get('nis');

    if (role === 'wali_murid') {
      // Dapatkan NIS santri yang terhubung dengan akun wali murid ini
      const [userRows] = await pool.execute<RowDataPacket[]>(
        `SELECT m.nis FROM users u 
         JOIN murid m ON u.murid_id = m.murid_id 
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      if (userRows.length === 0) {
        return NextResponse.json({ success: true, data: [], total_lunas: 0, total_belum: 0 });
      }
      const nis = userRows[0].nis;
      conditions.push('b.nis = ?');
      params.push(nis);
    }

    // Filter NIS spesifik jika ada dari query params
    if (nisFilter) {
      conditions.push('b.nis = ?');
      params.push(nisFilter);
    }

    // Filter kategori dari query param (untuk admin/staff)
    if (kategoriFilter && ['pesantren', 'madrasah'].includes(kategoriFilter)) {
      conditions.push('b.kategori = ?');
      params.push(kategoriFilter);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY b.id DESC';

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);

    // Format data billing + santri
    const resultData = rows.map((r: any) => ({
      id: r.id,
      nis: r.nis,
      nama_santri: r.nama_santri,
      nama_tagihan: r.nama_tagihan,
      nominal: Number(r.nominal),
      status: r.status,
      periode: r.periode,
      asrama: r.asrama,
      kamar: r.kamar,
      kategori: r.kategori || 'pesantren',
      // Info Tambahan Santri & Wali
      nama_wali: r.nama_wali || '-',
      no_wali: r.no_wali || '',
      foto_url: r.foto_url || null,
      alamat: r.alamat || '-'
    }));

    const totalLunas = resultData
      .filter((r: any) => r.status === 'Lunas')
      .reduce((acc: number, curr: any) => acc + curr.nominal, 0);

    const totalBelum = resultData
      .filter((r: any) => r.status === 'Belum')
      .reduce((acc: number, curr: any) => acc + curr.nominal, 0);

    return NextResponse.json({
      success: true,
      data: resultData,
      total_lunas: totalLunas,
      total_belum: totalBelum
    });

  } catch (error: any) {
    console.error('Error GET /api/billing:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
