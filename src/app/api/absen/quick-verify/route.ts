import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 400 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload as any).type !== 'quick_absen') {
      return NextResponse.json({ error: 'Token tidak valid atau sudah kadaluarsa (24 jam)' }, { status: 401 });
    }

    const { guru_id, guru_nama, user_id, jadwal_id, tipe, date } = payload as any;

    // Set session cookie agar user dianggap terautentikasi sebagai guru ini
    const authPayload = {
      userId: user_id || 0,
      username: `guru_${guru_id}`,
      role: 'guru',
      guruId: guru_id,
      nama: guru_nama
    };

    const sessionToken = signToken(authPayload);
    const cookieStore = await cookies();
    cookieStore.set('token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Ambil detail jadwal & murid sesuai tipe
    let jadwalDetail: any = null;
    let muridList: any[] = [];

    if (tipe === 'madin') {
      const [jRows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
                j.kelas_madin_id as kelas_id, k.nama_kelas
         FROM jadwal_madin j
         JOIN kelas_madin k ON j.kelas_madin_id = k.kelas_id
         WHERE j.jadwal_id = ?`,
        [jadwal_id]
      );
      if (jRows.length > 0) {
        jadwalDetail = jRows[0];
        const [mRows] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nis, nama, jenis_kelamin, kelas_madin_id
           FROM murid WHERE kelas_madin_id = ? ORDER BY nama ASC`,
          [jadwalDetail.kelas_id]
        );
        muridList = mRows;
      }
    } else if (tipe === 'quran') {
      const [jRows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
                j.kelas_quran_id as kelas_id, k.nama_kelas
         FROM jadwal_quran j
         JOIN kelas_quran k ON j.kelas_quran_id = k.id
         WHERE j.id = ?`,
        [jadwal_id]
      );
      if (jRows.length > 0) {
        jadwalDetail = jRows[0];
        const [mRows] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nis, nama, jenis_kelamin, kelas_quran_id
           FROM murid WHERE kelas_quran_id = ? ORDER BY nama ASC`,
          [jadwalDetail.kelas_id]
        );
        muridList = mRows;
      }
    } else if (tipe === 'kamar' || tipe === 'kegiatan') {
      const [jRows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.kegiatan_id as jadwal_id, j.jam_mulai, j.jam_selesai, j.nama_kegiatan as mata_pelajaran, j.hari,
                j.kamar_id as kelas_id, k.nama_kamar as nama_kelas
         FROM jadwal_kegiatan j
         JOIN kamar k ON j.kamar_id = k.kamar_id
         WHERE j.kegiatan_id = ?`,
        [jadwal_id]
      );
      if (jRows.length > 0) {
        jadwalDetail = jRows[0];
        const [mRows] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nis, nama, jenis_kelamin, kamar_id
           FROM murid WHERE kamar_id = ? ORDER BY nama ASC`,
          [jadwalDetail.kelas_id]
        );
        muridList = mRows;
      }
    }

    if (!jadwalDetail) {
      return NextResponse.json({ error: 'Detail jadwal tidak ditemukan di DB' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        guru_id,
        guru_nama,
        tipe,
        date: date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }),
        jadwal: jadwalDetail,
        murid: muridList
      }
    });
  } catch (error: any) {
    console.error('Error quick verify:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
