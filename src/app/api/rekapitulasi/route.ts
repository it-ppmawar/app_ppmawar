import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';

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
    const sub_filter = searchParams.get('sub_filter') || ''; // nama mapel/majlis/kegiatan

    // Mode: rentang tanggal atau bulan/tahun
    const isRentang = !!(tanggal_dari && tanggal_sampai);

    // Mode Tamu: return data kosong (bisa lihat halaman, tapi tanpa data)
    if (payload.role === 'tamu') {
      return NextResponse.json({ success: true, data: [] }, { headers: noCacheHeaders });
    }

    // Wali Murid & Wali Alumni Logic: pastikan muridId valid
    if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
      if (!payload.muridId) return NextResponse.json({ error: 'Murid ID tidak valid' }, { status: 400, headers: noCacheHeaders });
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
    let trendQuery = '';
    let trendParams: any[] = [];

    if (tipe === 'madin') {
      if (!target_id && payload.role !== 'wali_murid' && payload.role !== 'wali_alumni') {
        return NextResponse.json({ error: 'Pilih Kelas Madin' }, { status: 400, headers: noCacheHeaders });
      }

      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      let whereCond = 'WHERE (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?)';
      let whereParams: any[] = [target_id, target_id];

      if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
        whereCond = 'WHERE m.murid_id = ?';
        whereParams = [payload.muridId];
      } else if (target_id === 'all') {
        if (payload.role === 'guru' && payload.guruId) {
          whereCond = 'WHERE (m.kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?) OR m.kelas_madin_2_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?) OR km.guru_id = ?)';
          whereParams = [payload.guruId, payload.guruId, payload.guruId];
        } else {
          whereCond = 'WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL)';
          whereParams = [];
        }
      } else if (target_id === 'putra') {
        whereCond = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL) AND (km.nama_kelas LIKE '%PUTRA%' OR km.nama_kelas LIKE '%PA%' OR m.jenis_kelamin = 'Laki-laki' OR m.jenis_kelamin = 'L')`;
        whereParams = [];
      } else if (target_id === 'putri') {
        whereCond = `WHERE (m.kelas_madin_id IS NOT NULL OR m.kelas_madin_2_id IS NOT NULL) AND (km.nama_kelas LIKE '%PUTRI%' OR km.nama_kelas LIKE '%PI%' OR m.jenis_kelamin = 'Perempuan' OR m.jenis_kelamin = 'P')`;
        whereParams = [];
      }

      params = [...joinDateParams, ...whereParams];
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama, m.foto, m.alamat, m.nama_wali, m.no_wali, m.no_wali as no_hp_wali,
          COALESCE(MAX(a_sum.hadir), 0) as hadir,
          COALESCE(MAX(a_sum.izin), 0) as izin,
          COALESCE(MAX(a_sum.sakit), 0) as sakit,
          COALESCE(MAX(a_sum.alpha), 0) as alpha
        FROM murid m
        LEFT JOIN kelas_madin km ON (m.kelas_madin_id = km.kelas_id OR m.kelas_madin_2_id = km.kelas_id)
        LEFT JOIN (
          SELECT 
            a.murid_id,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'hadir' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jm.jam_mulai, '00:00'), '_', COALESCE(jm.mata_pelajaran, '')) END) as hadir,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'izin' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jm.jam_mulai, '00:00'), '_', COALESCE(jm.mata_pelajaran, '')) END) as izin,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'sakit' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jm.jam_mulai, '00:00'), '_', COALESCE(jm.mata_pelajaran, '')) END) as sakit,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jm.jam_mulai, '00:00'), '_', COALESCE(jm.mata_pelajaran, '')) END) as alpha
          FROM absensi a
          LEFT JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
          WHERE ${joinDateCond}
            ${sub_filter ? `AND jm.mata_pelajaran = '${sub_filter.replace(/'/g, "''")}'` : ''}
          GROUP BY a.murid_id
        ) a_sum ON m.murid_id = a_sum.murid_id
        ${whereCond}
        GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.alamat, m.nama_wali, m.no_wali
        ORDER BY m.nama ASC
      `;

      // Trend query madin
      const { cond: trendDateCond, params: trendDateParams } = makeDateCond('a.tanggal');
      let trendWhere = '';
      trendParams = [...trendDateParams];

      if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
        trendWhere = 'AND a.murid_id = ?';
        trendParams.push(payload.muridId);
      } else if (target_id === 'all') {
        if (payload.role === 'guru' && payload.guruId) {
          trendWhere = 'AND (m.kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?) OR m.kelas_madin_2_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?) OR km.guru_id = ?)';
          trendParams.push(payload.guruId, payload.guruId, payload.guruId);
        }
      } else if (target_id === 'putra') {
        trendWhere = `AND (km.nama_kelas LIKE '%PUTRA%' OR km.nama_kelas LIKE '%PA%' OR m.jenis_kelamin = 'Laki-laki' OR m.jenis_kelamin = 'L')`;
      } else if (target_id === 'putri') {
        trendWhere = `AND (km.nama_kelas LIKE '%PUTRI%' OR km.nama_kelas LIKE '%PI%' OR m.jenis_kelamin = 'Perempuan' OR m.jenis_kelamin = 'P')`;
      } else if (target_id) {
        trendWhere = 'AND (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?)';
        trendParams.push(target_id, target_id);
      }

      trendQuery = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_madin km ON (m.kelas_madin_id = km.kelas_id OR m.kelas_madin_2_id = km.kelas_id)
        LEFT JOIN jadwal_madin jm ON a.jadwal_madin_id = jm.jadwal_id
        WHERE ${trendDateCond} ${trendWhere}
          ${sub_filter ? `AND jm.mata_pelajaran = '${sub_filter.replace(/'/g, "''")}'` : ''}
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')
        ORDER BY tanggal ASC
      `;
    } else if (tipe === 'quran') {
      if (!target_id && payload.role !== 'wali_murid' && payload.role !== 'wali_alumni') {
        return NextResponse.json({ error: "Pilih Kelas Qur'an" }, { status: 400, headers: noCacheHeaders });
      }

      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      let whereCond = 'WHERE m.kelas_quran_id = ?';
      let whereParams: any[] = [target_id];

      if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
        whereCond = 'WHERE m.murid_id = ?';
        whereParams = [payload.muridId];
      } else if (target_id === 'all') {
        if (payload.role === 'guru' && payload.guruId) {
          whereCond = 'WHERE (m.kelas_quran_id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?) OR kq.guru_id = ?)';
          whereParams = [payload.guruId, payload.guruId];
        } else {
          whereCond = 'WHERE m.kelas_quran_id IS NOT NULL';
          whereParams = [];
        }
      } else if (target_id === 'putra') {
        whereCond = `WHERE m.kelas_quran_id IS NOT NULL AND (kq.nama_kelas LIKE '%PUTRA%' OR kq.nama_kelas LIKE '%PA%' OR m.jenis_kelamin = 'Laki-laki' OR m.jenis_kelamin = 'L')`;
        whereParams = [];
      } else if (target_id === 'putri') {
        whereCond = `WHERE m.kelas_quran_id IS NOT NULL AND (kq.nama_kelas LIKE '%PUTRI%' OR kq.nama_kelas LIKE '%PI%' OR m.jenis_kelamin = 'Perempuan' OR m.jenis_kelamin = 'P')`;
        whereParams = [];
      }

      params = [...joinDateParams, ...whereParams];
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama, m.foto, m.alamat, m.nama_wali, m.no_wali, m.no_wali as no_hp_wali,
          COALESCE(MAX(a_sum.hadir), 0) as hadir,
          COALESCE(MAX(a_sum.izin), 0) as izin,
          COALESCE(MAX(a_sum.sakit), 0) as sakit,
          COALESCE(MAX(a_sum.alpha), 0) as alpha
        FROM murid m
        LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
        LEFT JOIN (
          SELECT 
            a.murid_id,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'hadir' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jq.jam_mulai, '00:00'), '_', COALESCE(jq.mata_pelajaran, '')) END) as hadir,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'izin' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jq.jam_mulai, '00:00'), '_', COALESCE(jq.mata_pelajaran, '')) END) as izin,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'sakit' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jq.jam_mulai, '00:00'), '_', COALESCE(jq.mata_pelajaran, '')) END) as sakit,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jq.jam_mulai, '00:00'), '_', COALESCE(jq.mata_pelajaran, '')) END) as alpha
          FROM absensi_quran a
          LEFT JOIN jadwal_quran jq ON a.jadwal_quran_id = jq.id
          WHERE ${joinDateCond}
            ${sub_filter ? `AND jq.mata_pelajaran = '${sub_filter.replace(/'/g, "''")}'` : ''}
          GROUP BY a.murid_id
        ) a_sum ON m.murid_id = a_sum.murid_id
        ${whereCond}
        GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.alamat, m.nama_wali, m.no_wali
        ORDER BY m.nama ASC
      `;

      // Trend query quran
      const { cond: trendDateCond, params: trendDateParams } = makeDateCond('a.tanggal');
      let trendWhere = '';
      trendParams = [...trendDateParams];

      if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
        trendWhere = 'AND a.murid_id = ?';
        trendParams.push(payload.muridId);
      } else if (target_id === 'all') {
        if (payload.role === 'guru' && payload.guruId) {
          trendWhere = 'AND (m.kelas_quran_id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?) OR kq.guru_id = ?)';
          trendParams.push(payload.guruId, payload.guruId);
        }
      } else if (target_id === 'putra') {
        trendWhere = `AND (kq.nama_kelas LIKE '%PUTRA%' OR kq.nama_kelas LIKE '%PA%' OR m.jenis_kelamin = 'Laki-laki' OR m.jenis_kelamin = 'L')`;
      } else if (target_id === 'putri') {
        trendWhere = `AND (kq.nama_kelas LIKE '%PUTRI%' OR kq.nama_kelas LIKE '%PI%' OR m.jenis_kelamin = 'Perempuan' OR m.jenis_kelamin = 'P')`;
      } else if (target_id) {
        trendWhere = 'AND m.kelas_quran_id = ?';
        trendParams.push(target_id);
      }

      trendQuery = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_quran a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
        LEFT JOIN jadwal_quran jq ON a.jadwal_quran_id = jq.id
        WHERE ${trendDateCond} ${trendWhere}
          ${sub_filter ? `AND jq.mata_pelajaran = '${sub_filter.replace(/'/g, "''")}'` : ''}
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')
        ORDER BY tanggal ASC
      `;
    } else if (tipe === 'kegiatan') {
      if (!target_id && payload.role !== 'wali_murid' && payload.role !== 'wali_alumni') {
        return NextResponse.json({ error: 'Pilih Kamar Asrama' }, { status: 400, headers: noCacheHeaders });
      }

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

      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      let whereCond = 'WHERE m.kamar_id = ?';
      let whereParams: any[] = [target_id];

      if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
        whereCond = 'WHERE m.murid_id = ?';
        whereParams = [payload.muridId];
      } else if (target_id === 'all') {
        whereCond = 'WHERE m.kamar_id IS NOT NULL';
        whereParams = [];
      } else if (target_id && target_id.startsWith('asrama_')) {
        const asr = target_id.replace('asrama_', '');
        whereCond = 'WHERE km.nama_asrama = ?';
        whereParams = [asr];
      }

      params = [...joinDateParams, ...whereParams];
      query = `
        SELECT m.murid_id as id, m.nis as identifier, m.nama, m.foto, m.alamat, m.nama_wali, m.no_wali, m.no_wali as no_hp_wali,
          COALESCE(MAX(a_sum.hadir), 0) as hadir,
          COALESCE(MAX(a_sum.izin), 0) as izin,
          COALESCE(MAX(a_sum.sakit), 0) as sakit,
          COALESCE(MAX(a_sum.alpha), 0) as alpha
        FROM murid m
        LEFT JOIN kamar km ON m.kamar_id = km.kamar_id
        LEFT JOIN (
          SELECT 
            a.murid_id,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'hadir' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jk.jam_mulai, '00:00'), '_', COALESCE(jk.nama_kegiatan, '')) END) as hadir,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'izin' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jk.jam_mulai, '00:00'), '_', COALESCE(jk.nama_kegiatan, '')) END) as izin,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) = 'sakit' THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jk.jam_mulai, '00:00'), '_', COALESCE(jk.nama_kegiatan, '')) END) as sakit,
            COUNT(DISTINCT CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN CONCAT(DATE_FORMAT(a.tanggal, '%Y-%m-%d'), '_', COALESCE(jk.jam_mulai, '00:00'), '_', COALESCE(jk.nama_kegiatan, '')) END) as alpha
          FROM absensi_kegiatan a
          LEFT JOIN jadwal_kegiatan jk ON a.kegiatan_id = jk.kegiatan_id
          WHERE ${joinDateCond}
            ${sub_filter ? `AND jk.nama_kegiatan = '${sub_filter.replace(/'/g, "''")}'` : ''}
          GROUP BY a.murid_id
        ) a_sum ON m.murid_id = a_sum.murid_id
        ${whereCond}
        GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.alamat, m.nama_wali, m.no_wali
        ORDER BY m.nama ASC
      `;

      // Trend query kegiatan
      const { cond: trendDateCond, params: trendDateParams } = makeDateCond('a.tanggal');
      let trendWhere = '';
      trendParams = [...trendDateParams];

      if (payload.role === 'wali_murid' || payload.role === 'wali_alumni') {
        trendWhere = 'AND a.murid_id = ?';
        trendParams.push(payload.muridId);
      } else if (target_id === 'all') {
        trendWhere = 'AND m.kamar_id IS NOT NULL';
      } else if (target_id && target_id.startsWith('asrama_')) {
        trendWhere = 'AND km.nama_asrama = ?';
        trendParams.push(target_id.replace('asrama_', ''));
      } else if (target_id) {
        trendWhere = 'AND m.kamar_id = ?';
        trendParams.push(target_id);
      }

      trendQuery = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_kegiatan a
        JOIN murid m ON a.murid_id = m.murid_id
        LEFT JOIN kamar km ON m.kamar_id = km.kamar_id
        LEFT JOIN jadwal_kegiatan jk ON a.kegiatan_id = jk.kegiatan_id
        WHERE ${trendDateCond} ${trendWhere}
          ${sub_filter ? `AND jk.nama_kegiatan = '${sub_filter.replace(/'/g, "''")}'` : ''}
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')
        ORDER BY tanggal ASC
      `;
    } else if (tipe === 'guru') {
      if (payload.role !== 'admin' && payload.role !== 'staff') {
        return NextResponse.json({ error: 'Akses ditolak. Rekapitulasi/monitoring kehadiran guru hanya khusus Admin dan Staf.' }, { status: 403, headers: noCacheHeaders });
      }

      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      if (target_id && target_id !== 'all') {
        query = `
          SELECT g.guru_id as id, g.nip as identifier, g.nama, g.foto, g.alamat, g.no_hp, g.no_hp as nama_wali,
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
          SELECT g.guru_id as id, g.nip as identifier, g.nama, g.foto, g.alamat, g.no_hp, g.no_hp as nama_wali,
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

      // Trend query guru
      const { cond: trendDateCond, params: trendDateParams } = makeDateCond('a.tanggal');
      let trendWhere = '';
      trendParams = [...trendDateParams];
      if (target_id && target_id !== 'all') {
        trendWhere = 'AND a.guru_id = ?';
        trendParams.push(target_id);
      }

      trendQuery = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_guru a
        WHERE ${trendDateCond} ${trendWhere}
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')
        ORDER BY tanggal ASC
      `;
    } else if (tipe === 'dewan_guru') {
      const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
      if (payload.role !== 'admin' && payload.role !== 'staff' && !isPengasuh) {
        return NextResponse.json({ error: 'Akses ditolak. Rekapitulasi Presensi Dewan Guru hanya khusus Admin, Staf, dan Pengasuh.' }, { status: 403, headers: noCacheHeaders });
      }

      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      let whereCond = 'WHERE dg.aktif = 1';
      let whereParams: any[] = [];

      if (target_id && target_id !== 'SEMUA' && target_id !== 'all') {
        whereCond += ' AND dg.homebase = ?';
        whereParams.push(target_id);
      }

      query = `
        SELECT dg.id, dg.nip as identifier, dg.nama, dg.foto, dg.homebase, dg.homebase as alamat, dg.no_hp, dg.no_hp as nama_wali,
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') THEN 1 ELSE 0 END) as alpha
        FROM dewan_guru dg
        LEFT JOIN absensi_dewan_guru a ON dg.id = a.guru_id AND ${joinDateCond}
        ${whereCond}
        GROUP BY dg.id, dg.nip, dg.nama, dg.foto, dg.homebase, dg.no_hp
        ORDER BY dg.homebase ASC, dg.nama ASC
      `;
      params = [...joinDateParams, ...whereParams];

      // Trend query dewan_guru
      const { cond: trendDateCond, params: trendDateParams } = makeDateCond('a.tanggal');
      let trendWhere = 'AND dg.aktif = 1';
      trendParams = [...trendDateParams];
      if (target_id && target_id !== 'SEMUA' && target_id !== 'all') {
        trendWhere += ' AND dg.homebase = ?';
        trendParams.push(target_id);
      }

      trendQuery = `
        SELECT 
          DATE_FORMAT(a.tanggal, '%Y-%m-%d') as tanggal,
          SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') THEN 1 ELSE 0 END) as alpha,
          COUNT(*) as total
        FROM absensi_dewan_guru a
        JOIN dewan_guru dg ON a.guru_id = dg.id
        WHERE ${trendDateCond} ${trendWhere}
        GROUP BY DATE_FORMAT(a.tanggal, '%Y-%m-%d')
        ORDER BY tanggal ASC
      `;
    } else if (tipe === 'guru_mapel') {
      if (payload.role !== 'admin' && payload.role !== 'staff') {
        return NextResponse.json({ error: 'Akses ditolak. Rekapitulasi per mapel guru hanya khusus Admin dan Staf.' }, { status: 403, headers: noCacheHeaders });
      }

      const kategori = searchParams.get('kategori') || 'all'; // 'madin', 'quran', 'kegiatan', 'all'
      const { cond: joinDateCond, params: joinDateParams } = makeDateCond('a.tanggal');

      // target_id disini mewakili filter guru_id jika user memilih guru tertentu, atau 'all'
      const guruFilterId = target_id && target_id !== 'all' ? target_id : null;

      const subQueries: string[] = [];
      const subParams: any[] = [];

      // 1. Madin
      if (kategori === 'all' || kategori === 'madin') {
        subQueries.push(`
          SELECT 
            CONCAT('madin_', jm.jadwal_id) as id,
            jm.jadwal_id,
            jm.mata_pelajaran as nama,
            COALESCE(km.nama_kelas, '-') as kelas_nama,
            km.kelas_id as kelas_id,
            'madin' as kategori,
            'Madrasah Diniyah' as kategori_label,
            g.guru_id,
            COALESCE(g.nama, 'Belum Ditentukan') as guru_nama,
            COALESCE(g.nip, '-') as guru_nip,
            COALESCE(g.nip, '-') as identifier,
            COALESCE(g.no_hp, '') as no_hp,
            COALESCE(g.no_hp, '') as nama_wali,
            COALESCE(a_sum.hadir, 0) as hadir,
            COALESCE(a_sum.izin, 0) as izin,
            COALESCE(a_sum.sakit, 0) as sakit,
            COALESCE(a_sum.alpha, 0) as alpha,
            COALESCE(a_sum.total, 0) as total,
            COALESCE(a_sum.total_sesi, 0) as total_sesi
          FROM jadwal_madin jm
          LEFT JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
          LEFT JOIN guru g ON jm.guru_id = g.guru_id
          LEFT JOIN (
            SELECT 
              a.jadwal_madin_id,
              COUNT(*) as total,
              COUNT(DISTINCT a.tanggal) as total_sesi,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
            FROM absensi a
            WHERE ${joinDateCond}
            GROUP BY a.jadwal_madin_id
          ) a_sum ON jm.jadwal_id = a_sum.jadwal_madin_id
          WHERE 1=1 ${guruFilterId ? 'AND jm.guru_id = ?' : ''}
        `);
        subParams.push(...joinDateParams);
        if (guruFilterId) subParams.push(guruFilterId);
      }

      // 2. Quran
      if (kategori === 'all' || kategori === 'quran') {
        subQueries.push(`
          SELECT 
            CONCAT('quran_', jq.id) as id,
            jq.id as jadwal_id,
            COALESCE(jq.mata_pelajaran, "Majlis Al-Qur'an") as nama,
            COALESCE(kq.nama_kelas, '-') as kelas_nama,
            kq.id as kelas_id,
            'quran' as kategori,
            "Al-Qur'an" as kategori_label,
            g.guru_id,
            COALESCE(g.nama, 'Belum Ditentukan') as guru_nama,
            COALESCE(g.nip, '-') as guru_nip,
            COALESCE(g.nip, '-') as identifier,
            COALESCE(g.no_hp, '') as no_hp,
            COALESCE(g.no_hp, '') as nama_wali,
            COALESCE(a_sum.hadir, 0) as hadir,
            COALESCE(a_sum.izin, 0) as izin,
            COALESCE(a_sum.sakit, 0) as sakit,
            COALESCE(a_sum.alpha, 0) as alpha,
            COALESCE(a_sum.total, 0) as total,
            COALESCE(a_sum.total_sesi, 0) as total_sesi
          FROM jadwal_quran jq
          LEFT JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
          LEFT JOIN guru g ON jq.guru_id = g.guru_id
          LEFT JOIN (
            SELECT 
              a.jadwal_quran_id,
              COUNT(*) as total,
              COUNT(DISTINCT a.tanggal) as total_sesi,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
            FROM absensi_quran a
            WHERE ${joinDateCond}
            GROUP BY a.jadwal_quran_id
          ) a_sum ON jq.id = a_sum.jadwal_quran_id
          WHERE 1=1 ${guruFilterId ? 'AND jq.guru_id = ?' : ''}
        `);
        subParams.push(...joinDateParams);
        if (guruFilterId) subParams.push(guruFilterId);
      }

      // 3. Kegiatan Asrama
      if (kategori === 'all' || kategori === 'kegiatan') {
        subQueries.push(`
          SELECT 
            CONCAT('kegiatan_', jk.kegiatan_id) as id,
            jk.kegiatan_id as jadwal_id,
            jk.nama_kegiatan as nama,
            COALESCE(k.nama_kamar, '-') as kelas_nama,
            k.kamar_id as kelas_id,
            'kegiatan' as kategori,
            'Asrama' as kategori_label,
            g.guru_id,
            COALESCE(g.nama, 'Belum Ditentukan') as guru_nama,
            COALESCE(g.nip, '-') as guru_nip,
            COALESCE(g.nip, '-') as identifier,
            COALESCE(g.no_hp, '') as no_hp,
            COALESCE(g.no_hp, '') as nama_wali,
            COALESCE(a_sum.hadir, 0) as hadir,
            COALESCE(a_sum.izin, 0) as izin,
            COALESCE(a_sum.sakit, 0) as sakit,
            COALESCE(a_sum.alpha, 0) as alpha,
            COALESCE(a_sum.total, 0) as total,
            COALESCE(a_sum.total_sesi, 0) as total_sesi
          FROM jadwal_kegiatan jk
          LEFT JOIN kamar k ON jk.kamar_id = k.kamar_id
          LEFT JOIN guru g ON jk.guru_id = g.guru_id
          LEFT JOIN (
            SELECT 
              a.kegiatan_id,
              COUNT(*) as total,
              COUNT(DISTINCT a.tanggal) as total_sesi,
              SUM(CASE WHEN LOWER(a.status) = 'hadir' THEN 1 ELSE 0 END) as hadir,
              SUM(CASE WHEN LOWER(a.status) = 'izin' THEN 1 ELSE 0 END) as izin,
              SUM(CASE WHEN LOWER(a.status) = 'sakit' THEN 1 ELSE 0 END) as sakit,
              SUM(CASE WHEN LOWER(a.status) IN ('alpha', 'alpa') OR a.status = '' OR a.status IS NULL THEN 1 ELSE 0 END) as alpha
            FROM absensi_kegiatan a
            WHERE ${joinDateCond}
            GROUP BY a.kegiatan_id
          ) a_sum ON jk.kegiatan_id = a_sum.kegiatan_id
          WHERE 1=1 ${guruFilterId ? 'AND jk.guru_id = ?' : ''}
        `);
        subParams.push(...joinDateParams);
        if (guruFilterId) subParams.push(guruFilterId);
      }

      if (subQueries.length === 0) {
        query = 'SELECT NULL LIMIT 0';
        params = [];
      } else {
        query = `SELECT * FROM (${subQueries.join(' UNION ALL ')}) as all_mapel ORDER BY kelas_nama ASC, nama ASC`;
        params = subParams;
      }
    } else {
      return NextResponse.json({ error: 'Tipe rekap tidak valid' }, { status: 400, headers: noCacheHeaders });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);

    let trendRows: RowDataPacket[] = [];
    if (trendQuery) {
      try {
        const [tr] = await pool.execute<RowDataPacket[]>(trendQuery, trendParams);
        trendRows = tr;
      } catch (trendErr) {
        console.warn("Trend query error:", trendErr);
      }
    }

    const formattedTrend = trendRows.map(r => {
      const h = Number(r.hadir || 0);
      const i = Number(r.izin || 0);
      const s = Number(r.sakit || 0);
      const a = Number(r.alpha || 0);
      const tot = Number(r.total || (h + i + s + a));
      const pctHadir = tot > 0 ? Math.round((h / tot) * 1000) / 10 : 0;
      const pctIzin = tot > 0 ? Math.round((i / tot) * 1000) / 10 : 0;
      const pctSakit = tot > 0 ? Math.round((s / tot) * 1000) / 10 : 0;
      const pctAlpha = tot > 0 ? Math.round((a / tot) * 1000) / 10 : 0;
      return {
        tanggal: r.tanggal,
        hadir: h,
        izin: i,
        sakit: s,
        alpha: a,
        total: tot,
        pctHadir,
        pctIzin,
        pctSakit,
        pctAlpha,
      };
    });

    // Parameter masa berlaku token preview (minimal 1 hari, default 7 hari)
    const rawExpiry = searchParams.get('expiry') || '7';
    let days = parseInt(rawExpiry.replace(/[^0-9]/g, ''), 10);
    if (isNaN(days) || days < 1) days = 7;
    if (days > 365) days = 365;

    const expiryDuration = `${days}d`;
    const expiryDateObj = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const expDateFormatted = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    }).format(expiryDateObj);
    const durationLabel = `${days} Hari`;

    const formattedRows = rows.map((r: any) => {
      let preview_token = '';
      try {
        const isGuruType = tipe === 'guru' || tipe === 'dewan_guru' || tipe === 'guru_mapel';
        if (tipe === 'guru_mapel') {
          preview_token = signToken({
            jadwal_id: r.jadwal_id,
            tipe: r.kategori,
            target_id: r.kelas_id || '',
            sub_filter: r.nama,
            guru_id: r.guru_id,
            bulan: !isRentang ? bulan : undefined,
            tahun: !isRentang ? tahun : undefined,
            tanggal_dari: isRentang ? tanggal_dari : undefined,
            tanggal_sampai: isRentang ? tanggal_sampai : undefined,
            role: 'guru',
            purpose: 'rekap_preview'
          }, expiryDuration);
        } else {
          preview_token = signToken({
            muridId: isGuruType ? undefined : r.id,
            guruId: isGuruType ? r.id : undefined,
            guru_id: isGuruType ? r.id : undefined,
            tipe,
            target_id: target_id || '',
            sub_filter: sub_filter || '',
            bulan: !isRentang ? bulan : undefined,
            tahun: !isRentang ? tahun : undefined,
            tanggal_dari: isRentang ? tanggal_dari : undefined,
            tanggal_sampai: isRentang ? tanggal_sampai : undefined,
            role: isGuruType ? 'guru' : 'wali_murid',
            purpose: 'rekap_preview'
          }, expiryDuration);
        }
      } catch (_) {}
      return {
        ...r,
        no_hp: r.no_hp || r.nama_wali || '',
        preview_token,
        token_duration_label: durationLabel,
        token_exp_date: expDateFormatted,
        token_exp_timestamp: expiryDateObj.getTime()
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: formattedRows,
      trend: formattedTrend
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500, headers: noCacheHeaders });
  }
}
