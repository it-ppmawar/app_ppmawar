import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

// Endpoint debug sementara - hapus setelah masalah terselesaikan
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Tidak ada token', hasToken: false });
    }

    const payload = verifyToken(token) as any;

    if (!payload) {
      return NextResponse.json({ error: 'Token tidak valid', hasToken: true });
    }

    const { role, namaAsrama, userId } = payload;

    // Cek data user di database
    const [userRows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.role, u.kamar_id, k.nama_kamar, k.nama_asrama as db_nama_asrama
       FROM users u
       LEFT JOIN kamar k ON u.kamar_id = k.kamar_id
       WHERE u.id = ?`,
      [userId]
    );

    // Cek apakah kolom nama_asrama ada di tabel kamar
    const [kamarColumns] = await pool.execute<RowDataPacket[]>(
      `SHOW COLUMNS FROM kamar`
    );

    // Cek sample kamar dengan nama_asrama
    const [kamarSample] = await pool.execute<RowDataPacket[]>(
      `SELECT kamar_id, nama_kamar, nama_asrama FROM kamar LIMIT 5`
    );

    // Jika pengurus_asrama, cek apakah ada santri di asrama ini
    let santriCount = null;
    if (role === 'pengurus_asrama' && namaAsrama) {
      const [countResult] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM murid m
         JOIN kamar km ON m.kamar_id = km.kamar_id
         WHERE km.nama_asrama = ?`,
        [namaAsrama]
      );
      santriCount = countResult[0]?.total;
    }

    return NextResponse.json({
      token_payload: {
        userId,
        role,
        namaAsrama,
      },
      user_dari_db: userRows[0] || null,
      kolom_kamar: kamarColumns.map((c: any) => c.Field),
      sample_kamar: kamarSample,
      jumlah_santri_di_asrama: santriCount,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
