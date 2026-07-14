import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tipe = searchParams.get('tipe'); // 'madin', 'quran', 'kegiatan', 'guru'
    const target_id = searchParams.get('target_id'); // kelas_id, kamar_id
    const bulan = searchParams.get('bulan'); // 1-12
    const tahun = searchParams.get('tahun');

    // Wali Murid Logic
    if (payload.role === 'wali_murid') {
      if (!payload.muridId) return NextResponse.json({ error: 'Murid ID tidak valid' }, { status: 400 });
      
      const muridId = payload.muridId;
      // Ambil rekap untuk murid ini (Madin, Quran, Kegiatan) di bulan dan tahun yang dipilih
      const [madinRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 'Madin' as tipe, 
          SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha
         FROM absensi WHERE murid_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?`,
        [muridId, bulan, tahun]
      );
      const [quranRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 'Quran' as tipe, 
          SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha
         FROM absensi_quran WHERE murid_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?`,
        [muridId, bulan, tahun]
      );
      const [kegiatanRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 'Kegiatan' as tipe, 
          SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha
         FROM absensi_kegiatan WHERE murid_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?`,
        [muridId, bulan, tahun]
      );

      return NextResponse.json({
        success: true,
        data: [madinRows[0], quranRows[0], kegiatanRows[0]]
      });
    }

    // Admin/Staff/Guru Logic
    if (!tipe || !bulan || !tahun) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
    }

    let query = '';
    let params: any[] = [];

    if (tipe === 'madin') {
      if (!target_id) return NextResponse.json({ error: 'Pilih Kelas Madin' }, { status: 400 });
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama,
          SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
        FROM murid m
        LEFT JOIN absensi a ON m.murid_id = a.murid_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
        WHERE m.kelas_madin_id = ?
        GROUP BY m.murid_id
        ORDER BY m.nama ASC
      `;
      params = [bulan, tahun, target_id];
    } else if (tipe === 'quran') {
      if (!target_id) return NextResponse.json({ error: "Pilih Kelas Qur'an" }, { status: 400 });
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama,
          SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
        FROM murid m
        LEFT JOIN absensi_quran a ON m.murid_id = a.murid_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
        WHERE m.kelas_quran_id = ?
        GROUP BY m.murid_id
        ORDER BY m.nama ASC
      `;
      params = [bulan, tahun, target_id];
    } else if (tipe === 'kegiatan') {
      if (!target_id) return NextResponse.json({ error: 'Pilih Kamar Asrama' }, { status: 400 });
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama,
          SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
        FROM murid m
        LEFT JOIN absensi_kegiatan a ON m.murid_id = a.murid_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
        WHERE m.kamar_id = ?
        GROUP BY m.murid_id
        ORDER BY m.nama ASC
      `;
      params = [bulan, tahun, target_id];
    } else if (tipe === 'guru') {
      if (target_id && target_id !== 'all') {
        query = `
          SELECT g.guru_id as id, g.nip as identifier, g.nama,
            SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
            SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
            SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
          FROM guru g
          LEFT JOIN absensi_guru a ON g.guru_id = a.guru_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
          WHERE g.guru_id = ?
          GROUP BY g.guru_id
          ORDER BY g.nama ASC
        `;
        params = [bulan, tahun, target_id];
      } else {
        query = `
          SELECT g.guru_id as id, g.nip as identifier, g.nama,
            SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
            SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
            SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
          FROM guru g
          LEFT JOIN absensi_guru a ON g.guru_id = a.guru_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
          GROUP BY g.guru_id
          ORDER BY g.nama ASC
        `;
        params = [bulan, tahun];
      }
    } else {
      return NextResponse.json({ error: 'Tipe rekap tidak valid' }, { status: 400 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ success: true, data: rows });

  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
