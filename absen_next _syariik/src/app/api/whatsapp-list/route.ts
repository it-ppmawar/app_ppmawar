import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, muridId, namaAsrama } = payload as any;

    let sql = 'SELECT m.murid_id, m.nama, m.no_wali, m.nama_wali, m.kelas_quran_id, m.kelas_madin_id, m.kamar_id FROM murid m';
    let params: any[] = [];

    if (role === 'admin' || role === 'staff') {
      // Admin & staff: akses semua santri
      sql += ' ORDER BY m.nama ASC';
    } else if (role === 'pengurus_asrama') {
      // Pengurus asrama: hanya santri di asrama mereka
      if (namaAsrama) {
        sql += ' LEFT JOIN kamar k ON m.kamar_id = k.kamar_id WHERE k.nama_asrama = ? ORDER BY m.nama ASC';
        params = [namaAsrama];
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    } else if (role === 'guru') {
      // Guru: hanya santri di kelas/kamar yang diajarnya
      if (guruId) {
        sql += ` WHERE (
          m.kelas_madin_id IN (SELECT kelas_id FROM kelas_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT id FROM kelas_quran WHERE guru_id = ?)
          OR m.kamar_id IN (SELECT kamar_id FROM kamar WHERE guru_id = ?)
          OR m.kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?)
        ) ORDER BY m.nama ASC`;
        params = [guruId, guruId, guruId, guruId, guruId];
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    } else if (role === 'wali_murid') {
      // Wali murid: hanya anaknya sendiri
      if (muridId) {
        sql += ' WHERE m.murid_id = ? ORDER BY m.nama ASC';
        params = [muridId];
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    } else {
      return NextResponse.json({ success: true, data: [] });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
