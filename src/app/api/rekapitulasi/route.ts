import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noCacheHeaders = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noCacheHeaders });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401, headers: noCacheHeaders });

    const { searchParams } = new URL(request.url);
    const tipe = searchParams.get('tipe'); // 'madin', 'quran', 'kegiatan', 'guru'
    const target_id = searchParams.get('target_id'); // kelas_id, kamar_id
    const bulan = searchParams.get('bulan'); // 1-12
    const tahun = searchParams.get('tahun');
    const tanggal_dari = searchParams.get('tanggal_dari'); // YYYY-MM-DD
    const tanggal_sampai = searchParams.get('tanggal_sampai'); // YYYY-MM-DD

    // Mode: rentang tanggal atau bulan/tahun
    const isRentang = !!(tanggal_dari && tanggal_sampai);

    // Wali Murid & Wali Alumni Logic (akses rekap anak masing-masing)
    if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
      if (!payload.muridId) return NextResponse.json({ error: 'Murid ID tidak valid' }, { status: 400, headers: noCacheHeaders });
      
      const muridId = payload.muridId;

      let dateCondMadin = 'MONTH(tanggal) = ? AND YEAR(tanggal) = ?';
      let dateCondQuran = 'MONTH(tanggal) = ? AND YEAR(tanggal) = ?';
      let dateCondKegiatan = 'MONTH(tanggal) = ? AND YEAR(tanggal) = ?';
      let dateParamsMadin = [muridId, bulan, tahun];
      let dateParamsQuran = [muridId, bulan, tahun];
      let dateParamsKegiatan = [muridId, bulan, tahun];

      if (isRentang) {
        dateCondMadin = 'tanggal BETWEEN ? AND ?';
        dateCondQuran = 'tanggal BETWEEN ? AND ?';
        dateCondKegiatan = 'tanggal BETWEEN ? AND ?';
        dateParamsMadin = [muridId, tanggal_dari, tanggal_sampai];
        dateParamsQuran = [muridId, tanggal_dari, tanggal_sampai];
        dateParamsKegiatan = [muridId, tanggal_dari, tanggal_sampai];
      }

      const [madinRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 'Madin' as tipe, 
          SUM(CASE WHEN LOWER(status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(status) IN ('alpha', 'alpa') OR status = '' OR status IS NULL THEN 1 ELSE 0 END) as alpha
         FROM absensi WHERE murid_id = ? AND ${dateCondMadin}`,
        dateParamsMadin
      );
      const [quranRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 'Quran' as tipe, 
          SUM(CASE WHEN LOWER(status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(status) IN ('alpha', 'alpa') OR status = '' OR status IS NULL THEN 1 ELSE 0 END) as alpha
         FROM absensi_quran WHERE murid_id = ? AND ${dateCondQuran}`,
        dateParamsQuran
      );
      const [kegiatanRows] = await pool.execute<RowDataPacket[]>(
        `SELECT 'Kegiatan' as tipe, 
          SUM(CASE WHEN LOWER(status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(status) IN ('alpha', 'alpa') OR status = '' OR status IS NULL THEN 1 ELSE 0 END) as alpha
         FROM absensi_kegiatan WHERE murid_id = ? AND ${dateCondKegiatan}`,
        dateParamsKegiatan
      );

      return NextResponse.json({
        success: true,
        data: [madinRows[0], quranRows[0], kegiatanRows[0]]
      }, { headers: noCacheHeaders });
    }

    // Admin/Staff/Guru Logic
    if (!tipe || (!isRentang && (!bulan || !tahun))) {
      return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400, headers: noCacheHeaders });
    }

    // Helper params builder untuk tanggal
    const makeDateCond = (col: string): { cond: string; params: any[] } => {
      if (isRentang) {
        return {
          cond: `${col} BETWEEN ? AND ?`,
          params: [tanggal_dari, tanggal_sampai],
        };
      }
      return {
        cond: `MONTH(${col}) = ? AND YEAR(${col}) = ?`,
        params: [bulan, tahun],
      };
    };

    let query = '';
    let params: any[] = [];

    if (tipe === 'madin') {
      if (!target_id) return NextResponse.json({ error: 'Pilih Kelas Madin' }, { status: 400, headers: noCacheHeaders });

      // Subquery hadir: tabel absensi tanpa alias
      const { cond: subDateCond, params: subDateParams } = makeDateCond('tanggal');
      // Subquery scan kamar: tabel absensi_kamar alias ak
      const { cond: scanDateCond, params: scanDateParams } = makeDateCond('ak.tanggal');
      // JOIN absensi utama: alias a
      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      let whereCond = 'WHERE (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?)';
      let whereParams: any[] = [target_id, target_id];

      if (target_id === 'all') {
        whereCond = 'WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL)';
        whereParams = [];
      } else if (target_id === 'putra') {
        whereCond = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL) AND (km.nama_kelas LIKE '%PUTRA%' OR km.nama_kelas LIKE '%PA%' OR m.jenis_kelamin = 'Laki-laki' OR m.jenis_kelamin = 'L')`;
        whereParams = [];
      } else if (target_id === 'putri') {
        whereCond = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL) AND (km.nama_kelas LIKE '%PUTRI%' OR km.nama_kelas LIKE '%PI%' OR m.jenis_kelamin = 'Perempuan' OR m.jenis_kelamin = 'P')`;
        whereParams = [];
      }

      params = [...subDateParams, ...scanDateParams, ...joinDateParams, ...whereParams];
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama, m.foto, m.alamat, m.nama_wali,
          COUNT(DISTINCT att.tanggal) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
        FROM murid m
        LEFT JOIN kelas_madin km ON (m.kelas_madin_id = km.kelas_id OR m.kelas_madin_2_id = km.kelas_id)
        LEFT JOIN (
          SELECT murid_id, tanggal FROM absensi WHERE LOWER(status) = 'hadir' AND ${subDateCond}
          UNION
          SELECT ak.murid_id, ak.tanggal
          FROM absensi_kamar ak
          JOIN jadwal_madin jm ON jm.kelas_madin_id = (
            SELECT kelas_madin_id FROM murid WHERE murid_id = ak.murid_id LIMIT 1
          ) AND jm.hari = DAYNAME(ak.tanggal)
          WHERE ${scanDateCond}
        ) att ON m.murid_id = att.murid_id
        LEFT JOIN absensi a ON m.murid_id = a.murid_id AND ${joinDateCond}
        ${whereCond}
        GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.alamat, m.nama_wali
        ORDER BY m.nama ASC
      `;
    } else if (tipe === 'quran') {
      if (!target_id) return NextResponse.json({ error: "Pilih Kelas Qur'an" }, { status: 400, headers: noCacheHeaders });

      const { cond: subDateCond, params: subDateParams } = makeDateCond('tanggal');
      const { cond: scanDateCond, params: scanDateParams } = makeDateCond('ak.tanggal');
      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      let whereCond = 'WHERE m.kelas_quran_id = ?';
      let whereParams: any[] = [target_id];

      if (target_id === 'all') {
        whereCond = 'WHERE m.kelas_quran_id IS NOT NULL';
        whereParams = [];
      } else if (target_id === 'putra') {
        whereCond = `WHERE m.kelas_quran_id IS NOT NULL AND (kq.nama_kelas LIKE '%PUTRA%' OR kq.nama_kelas LIKE '%PA%' OR m.jenis_kelamin = 'Laki-laki' OR m.jenis_kelamin = 'L')`;
        whereParams = [];
      } else if (target_id === 'putri') {
        whereCond = `WHERE m.kelas_quran_id IS NOT NULL AND (kq.nama_kelas LIKE '%PUTRI%' OR kq.nama_kelas LIKE '%PI%' OR m.jenis_kelamin = 'Perempuan' OR m.jenis_kelamin = 'P')`;
        whereParams = [];
      }

      params = [...subDateParams, ...scanDateParams, ...joinDateParams, ...whereParams];
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama, m.foto, m.alamat, m.nama_wali,
          COUNT(DISTINCT att.tanggal) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
        FROM murid m
        LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
        LEFT JOIN (
          SELECT murid_id, tanggal FROM absensi_quran WHERE LOWER(status) = 'hadir' AND ${subDateCond}
          UNION
          SELECT ak.murid_id, ak.tanggal
          FROM absensi_kamar ak
          JOIN jadwal_quran jq ON jq.kelas_quran_id = (
            SELECT kelas_quran_id FROM murid WHERE murid_id = ak.murid_id LIMIT 1
          ) AND jq.hari = DAYNAME(ak.tanggal)
          WHERE ${scanDateCond}
        ) att ON m.murid_id = att.murid_id
        LEFT JOIN absensi_quran a ON m.murid_id = a.murid_id AND ${joinDateCond}
        ${whereCond}
        GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.alamat, m.nama_wali
        ORDER BY m.nama ASC
      `;
    } else if (tipe === 'kegiatan') {
      if (!target_id) return NextResponse.json({ error: 'Pilih Kamar Asrama' }, { status: 400, headers: noCacheHeaders });

      // Auto-fix: Perbaiki tanggal di absensi_kamar jika sempat salah akibat timezone UTC offset
      try {
        await pool.execute(`
          UPDATE absensi_kamar 
          SET tanggal = DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) 
          WHERE created_at IS NOT NULL 
            AND DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) != tanggal
        `);
      } catch (fixErr: any) {
        try {
          await pool.execute(`
            UPDATE absensi_kamar 
            SET tanggal = DATE(created_at) 
            WHERE created_at IS NOT NULL 
              AND DATE(created_at) != tanggal
          `);
        } catch (_) {}
      }

      // Subquery untuk absensi_kegiatan (att_k.tanggal) & absensi_kamar (att_s.tanggal)
      const { cond: subDateCond1, params: subDateParams1 } = makeDateCond('att_k.tanggal');
      const { cond: subDateCond2, params: subDateParams2 } = makeDateCond('att_s.tanggal');
      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      let whereCond = 'WHERE m.kamar_id = ?';
      let whereParams: any[] = [target_id];

      if (target_id === 'all') {
        whereCond = 'WHERE m.kamar_id IS NOT NULL';
        whereParams = [];
      } else if (target_id.startsWith('asrama_')) {
        const asr = target_id.replace('asrama_', '');
        whereCond = 'WHERE km.nama_asrama = ?';
        whereParams = [asr];
      }

      params = [...subDateParams1, ...subDateParams2, ...joinDateParams, ...whereParams];
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama, m.foto, m.alamat, m.nama_wali,
          COUNT(DISTINCT att.tanggal) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
        FROM murid m
        LEFT JOIN kamar km ON m.kamar_id = km.kamar_id
        LEFT JOIN (
          SELECT murid_id, tanggal FROM absensi_kegiatan att_k WHERE LOWER(status) = 'hadir' AND ${subDateCond1}
          UNION
          SELECT murid_id, tanggal FROM absensi_kamar att_s WHERE ${subDateCond2}
        ) att ON m.murid_id = att.murid_id
        LEFT JOIN absensi_kegiatan a ON m.murid_id = a.murid_id AND ${joinDateCond}
        ${whereCond}
        GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.alamat, m.nama_wali
        ORDER BY m.nama ASC
      `;
    } else if (tipe === 'guru') {
      if (payload.role !== 'admin' && payload.role !== 'staff') {
        return NextResponse.json({ error: 'Akses ditolak. Rekapitulasi/monitoring kehadiran guru hanya khusus Admin dan Staf.' }, { status: 403, headers: noCacheHeaders });
      }

      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      if (target_id && target_id !== 'all') {
        query = `
          SELECT g.guru_id as id, g.nip as identifier, g.nama, g.foto, g.alamat, g.no_hp as nama_wali,
            SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
            SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
            SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
          FROM guru g
          LEFT JOIN absensi_guru a ON g.guru_id = a.guru_id AND ${joinDateCond}
          WHERE g.guru_id = ?
          GROUP BY g.guru_id, g.nip, g.nama, g.foto, g.alamat, g.no_hp
          ORDER BY g.nama ASC
        `;
        params = [...joinDateParams, target_id];
      } else {
        query = `
          SELECT g.guru_id as id, g.nip as identifier, g.nama, g.foto, g.alamat, g.no_hp as nama_wali,
            SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
            SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
            SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
            SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
          FROM guru g
          LEFT JOIN absensi_guru a ON g.guru_id = a.guru_id AND ${joinDateCond}
          GROUP BY g.guru_id, g.nip, g.nama, g.foto, g.alamat, g.no_hp
          ORDER BY g.nama ASC
        `;
        params = [...joinDateParams];
      }
    } else {
      return NextResponse.json({ error: 'Tipe rekap tidak valid' }, { status: 400, headers: noCacheHeaders });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    return NextResponse.json({ success: true, data: rows }, { headers: noCacheHeaders });

  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500, headers: noCacheHeaders });
  }
}
