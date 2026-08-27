import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role === 'wali_murid') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { role, userId, username } = payload;
    const tokenAsrama = payload.namaAsrama || null;

    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

    const { searchParams } = new URL(request.url);
    const tipe = searchParams.get('tipe');
    const kelas_id = searchParams.get('kelas_id');
    const jadwal_id = searchParams.get('jadwal_id'); // Just in case we need it to check existing absensi

    if (!tipe || !kelas_id) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

    if (role === 'pengurus_asrama' || role === 'pengasuh') {
      if (!namaAsrama) {
        return NextResponse.json({ error: 'Akses ditolak: Asrama tidak terdefinisi' }, { status: 403 });
      }
      if (role === 'pengasuh' && (tipe === 'madin' || tipe === 'quran')) {
        return NextResponse.json({ error: 'Akses ditolak: Pengasuh hanya dapat mengakses absensi kegiatan pesantren' }, { status: 403 });
      }
      if (tipe === 'madin') {
        const [check] = await pool.execute<RowDataPacket[]>(
          `SELECT 1 FROM murid m 
           JOIN kamar km ON m.kamar_id = km.kamar_id 
           WHERE km.nama_asrama = ? AND (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?) LIMIT 1`,
          [namaAsrama, kelas_id, kelas_id]
        );
        if (check.length === 0) {
          return NextResponse.json({ error: 'Akses ditolak: Kelas Madin ini tidak memiliki santri dari asrama Anda' }, { status: 403 });
        }
      } else if (tipe === 'quran') {
        const [check] = await pool.execute<RowDataPacket[]>(
          `SELECT 1 FROM murid m 
           JOIN kamar km ON m.kamar_id = km.kamar_id 
           WHERE km.nama_asrama = ? AND m.kelas_quran_id = ?
           UNION
           SELECT 1 FROM kelas_quran
           WHERE nama_kelas LIKE ? AND id = ? LIMIT 1`,
          [namaAsrama, kelas_id, `%${namaAsrama}%`, kelas_id]
        );
        if (check.length === 0) {
          return NextResponse.json({ error: 'Akses ditolak: Kelas Qur\'an ini tidak memiliki santri dari asrama Anda' }, { status: 403 });
        }
      } else if (tipe === 'kegiatan') {
        const [check] = await pool.execute<RowDataPacket[]>(
          `SELECT 1 FROM kamar WHERE nama_asrama = ? AND kamar_id = ? LIMIT 1`,
          [namaAsrama, kelas_id]
        );
        if (check.length === 0) {
          return NextResponse.json({ error: 'Akses ditolak: Kamar ini tidak termasuk asrama Anda' }, { status: 403 });
        }
      }
    }

    let query = '';
    let params: any[] = [kelas_id];

    if ((role === 'pengurus_asrama' || role === 'pengasuh') && namaAsrama) {
      // Pengurus asrama hanya melihat santri dari asrama mereka sendiri
      if (tipe === 'madin') {
        query = `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.alamat, m.nama_wali FROM murid m
          JOIN kamar km ON m.kamar_id = km.kamar_id
          WHERE (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?) AND km.nama_asrama = ? ORDER BY m.nama ASC`;
        params = [kelas_id, kelas_id, namaAsrama];
      } else if (tipe === 'quran') {
        query = `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.alamat, m.nama_wali FROM murid m
          JOIN kamar km ON m.kamar_id = km.kamar_id
          WHERE m.kelas_quran_id = ? AND km.nama_asrama = ? ORDER BY m.nama ASC`;
        params = [kelas_id, namaAsrama];
      } else if (tipe === 'kegiatan') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat, nama_wali FROM murid WHERE kamar_id = ? ORDER BY nama ASC';
      } else {
        return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
      }
    } else if (role === 'staff') {
      const asr = (namaAsrama || payload.asrama || '').toLowerCase();
      let genderFilter = '';
      if (asr.includes('putra') || asr.includes('asrama a') || asr === 'a') {
        genderFilter = " AND m.jenis_kelamin = 'Laki-laki'";
      } else if (asr.includes('putri') || asr.includes('asrama b') || asr.includes('asrama c') || asr.includes('asrama d') || asr.includes('asrama e') || asr.includes('asrama f') || ['b', 'c', 'd', 'e', 'f'].includes(asr.trim())) {
        genderFilter = " AND m.jenis_kelamin = 'Perempuan'";
      }

      if (tipe === 'madin') {
        query = `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.alamat, m.nama_wali FROM murid m WHERE (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?)${genderFilter} ORDER BY m.nama ASC`;
        params = [kelas_id, kelas_id];
      } else if (tipe === 'quran') {
        query = `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.alamat, m.nama_wali FROM murid m WHERE m.kelas_quran_id = ?${genderFilter} ORDER BY m.nama ASC`;
        params = [kelas_id];
      } else if (tipe === 'kegiatan') {
        query = `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.alamat, m.nama_wali FROM murid m WHERE m.kamar_id = ?${genderFilter} ORDER BY m.nama ASC`;
        params = [kelas_id];
      } else {
        return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
      }
    } else {
      if (tipe === 'madin') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat, nama_wali FROM murid WHERE kelas_madin_id = ? OR kelas_madin_2_id = ? ORDER BY nama ASC';
        params = [kelas_id, kelas_id];
      } else if (tipe === 'quran') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat, nama_wali FROM murid WHERE kelas_quran_id = ? ORDER BY nama ASC';
        params = [kelas_id];
      } else if (tipe === 'kegiatan') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat, nama_wali FROM murid WHERE kamar_id = ? ORDER BY nama ASC';
        params = [kelas_id];
      } else {
        return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
      }
    }

    const [murid] = await pool.execute<RowDataPacket[]>(query, params);

    // Get today's date in YYYY-MM-DD (Asia/Jakarta WIB)
    const localISOTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());

    // Auto-sync data scan kamar ke absensi_kegiatan jika belum ada
    if (tipe === 'kegiatan') {
      try {
        await pool.execute(`
          INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status, keterangan)
          SELECT ?, ak.murid_id, ak.tanggal, 'Hadir', 'Scan Kartu'
          FROM absensi_kamar ak
          JOIN murid m ON ak.murid_id = m.murid_id
          LEFT JOIN absensi_kegiatan existing 
            ON existing.kegiatan_id = ? 
            AND existing.murid_id = ak.murid_id 
            AND existing.tanggal = ak.tanggal
          WHERE ak.tanggal = ? 
            AND (m.kamar_id = ? OR ? = '') 
            AND existing.absensi_kegiatan_id IS NULL
        `, [jadwal_id, jadwal_id, localISOTime, kelas_id || '', kelas_id || '']);
      } catch (e) {
        console.error('Auto sync absensi_kamar -> absensi_kegiatan failed:', e);
      }
    }

    // Fetch existing attendance across all sibling schedules in this class session (Team Teaching)
    let siblingJadwalIds: any[] = [jadwal_id];
    try {
      if (tipe === 'madin') {
        const [sibRows]: any = await pool.execute(
          `SELECT jadwal_id FROM jadwal_madin WHERE (kelas_madin_id = ? OR kelas_madin_id = ?) AND hari = (SELECT hari FROM jadwal_madin WHERE jadwal_id = ? LIMIT 1)`,
          [kelas_id, kelas_id, jadwal_id]
        );
        siblingJadwalIds = Array.from(new Set([...siblingJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      } else if (tipe === 'quran') {
        const [sibRows]: any = await pool.execute(
          `SELECT id as jadwal_id FROM jadwal_quran WHERE kelas_quran_id = ? AND hari = (SELECT hari FROM jadwal_quran WHERE id = ? LIMIT 1)`,
          [kelas_id, jadwal_id]
        );
        siblingJadwalIds = Array.from(new Set([...siblingJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      } else if (tipe === 'kegiatan') {
        const [sibRows]: any = await pool.execute(
          `SELECT kegiatan_id as jadwal_id FROM jadwal_kegiatan WHERE kamar_id = ? AND hari = (SELECT hari FROM jadwal_kegiatan WHERE kegiatan_id = ? LIMIT 1)`,
          [kelas_id, jadwal_id]
        );
        siblingJadwalIds = Array.from(new Set([...siblingJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      }
    } catch (e) {
      console.warn('Find sibling schedules notice in input GET:', e);
    }

    const placeholdersJadwal = siblingJadwalIds.map(() => '?').join(',');
    let existingQuery = '';
    let existingParams = [...siblingJadwalIds, localISOTime];

    if (tipe === 'madin') existingQuery = `SELECT murid_id, status, keterangan FROM absensi WHERE jadwal_madin_id IN (${placeholdersJadwal}) AND tanggal = ?`;
    else if (tipe === 'quran') existingQuery = `SELECT murid_id, status, keterangan FROM absensi_quran WHERE jadwal_quran_id IN (${placeholdersJadwal}) AND tanggal = ?`;
    else if (tipe === 'kegiatan') existingQuery = `SELECT murid_id, status, keterangan FROM absensi_kegiatan WHERE kegiatan_id IN (${placeholdersJadwal}) AND tanggal = ?`;

    const [existing] = await pool.execute<RowDataPacket[]>(existingQuery, existingParams);
    
    const existingMap = existing.reduce((acc: any, curr: any) => {
      acc[curr.murid_id] = { status: curr.status, keterangan: curr.keterangan || '' };
      return acc;
    }, {});

    const mappedMurid = murid.map(m => ({
      ...m,
      status: existingMap[m.murid_id]?.status || 'Hadir',
      keterangan: existingMap[m.murid_id]?.keterangan || ''
    }));

    // Query nama kelas/kamar untuk laporan
    let namaTarget = 'Kelas/Kamar';
    try {
      if (tipe === 'madin') {
        const [rows]: any = await pool.execute('SELECT nama_kelas FROM kelas_madin WHERE kelas_id = ? LIMIT 1', [kelas_id]);
        if (rows.length > 0) namaTarget = `Kelas Madin ${rows[0].nama_kelas}`;
      } else if (tipe === 'quran') {
        const [rows]: any = await pool.execute('SELECT nama_kelas FROM kelas_quran WHERE id = ? LIMIT 1', [kelas_id]);
        if (rows.length > 0) namaTarget = `Kelas Qur'an ${rows[0].nama_kelas}`;
      } else if (tipe === 'kegiatan') {
        const [rows]: any = await pool.execute('SELECT nama_kamar, nama_asrama FROM kamar WHERE kamar_id = ? LIMIT 1', [kelas_id]);
        if (rows.length > 0) {
          namaTarget = `Kamar ${rows[0].nama_kamar} (${rows[0].nama_asrama || 'Asrama'})`;
        }
      }
    } catch (e) {
      console.error('Error fetching target name:', e);
    }

    const sudah_absen = existing.length > 0;

    // Query info jadwal (mata pelajaran, jam, guru) untuk ditampilkan di header halaman
    let jadwalInfo: { mata_pelajaran: string; jam_mulai: string; jam_selesai: string; guru_id?: number; guru_nama?: string } | null = null;
    try {
      if (tipe === 'madin') {
        const [rows]: any = await pool.execute(
          `SELECT j.mata_pelajaran, j.jam_mulai, j.jam_selesai, j.guru_id, g.nama AS guru_nama 
           FROM jadwal_madin j 
           LEFT JOIN guru g ON j.guru_id = g.guru_id 
           WHERE (j.jadwal_id = ? AND j.jadwal_id > 0) OR j.kelas_madin_id = ? 
           ORDER BY (j.jadwal_id = ?) DESC LIMIT 1`,
          [jadwal_id || 0, kelas_id, jadwal_id || 0]
        );
        if (rows.length > 0) {
          jadwalInfo = {
            mata_pelajaran: rows[0].mata_pelajaran || '',
            jam_mulai: rows[0].jam_mulai || '',
            jam_selesai: rows[0].jam_selesai || '',
            guru_id: rows[0].guru_id,
            guru_nama: rows[0].guru_nama || 'Guru Madin'
          };
        }
      } else if (tipe === 'quran') {
        const [rows]: any = await pool.execute(
          `SELECT j.mata_pelajaran, j.jam_mulai, j.jam_selesai, j.guru_id, g.nama AS guru_nama 
           FROM jadwal_quran j 
           LEFT JOIN guru g ON j.guru_id = g.guru_id 
           WHERE (j.id = ? AND j.id > 0) OR j.kelas_quran_id = ? 
           ORDER BY (j.id = ?) DESC LIMIT 1`,
          [jadwal_id || 0, kelas_id, jadwal_id || 0]
        );
        if (rows.length > 0) {
          jadwalInfo = {
            mata_pelajaran: rows[0].mata_pelajaran || '',
            jam_mulai: rows[0].jam_mulai || '',
            jam_selesai: rows[0].jam_selesai || '',
            guru_id: rows[0].guru_id,
            guru_nama: rows[0].guru_nama || "Guru Qur'an"
          };
        }
      } else if (tipe === 'kegiatan') {
        const [rows]: any = await pool.execute(
          `SELECT j.nama_kegiatan AS mata_pelajaran, j.jam_mulai, j.jam_selesai, j.guru_id, g.nama AS guru_nama 
           FROM jadwal_kegiatan j 
           LEFT JOIN guru g ON j.guru_id = g.guru_id 
           WHERE (j.kegiatan_id = ? AND j.kegiatan_id > 0) OR j.kamar_id = ? 
           ORDER BY (j.kegiatan_id = ?) DESC LIMIT 1`,
          [jadwal_id || 0, kelas_id, jadwal_id || 0]
        );
        if (rows.length > 0) {
          jadwalInfo = {
            mata_pelajaran: rows[0].mata_pelajaran || '',
            jam_mulai: rows[0].jam_mulai || '',
            jam_selesai: rows[0].jam_selesai || '',
            guru_id: rows[0].guru_id,
            guru_nama: rows[0].guru_nama || 'Pembina Asrama'
          };
        }
      }
    } catch (e) {
      console.error('Error fetching jadwal info:', e);
    }

    return NextResponse.json({ success: true, data: mappedMurid, namaTarget, sudah_absen, jadwalInfo, tanggal: localISOTime });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role === 'wali_murid') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { tipe, jadwal_id, jadwal_ids, absensi } = body;

    const targetJadwalIds = Array.isArray(jadwal_ids) && jadwal_ids.length > 0
      ? jadwal_ids
      : (jadwal_id ? [jadwal_id] : []);

    if (!tipe || targetJadwalIds.length === 0 || !absensi || !Array.isArray(absensi)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    const { role, userId, username } = payload;
    const tokenAsrama = payload.namaAsrama || null;
    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

    // Validasi jangkauan radius lokasi absensi (berlaku untuk semua pengguna yang menginput absensi)
    const [settingRows] = await connection.execute<RowDataPacket[]>(
      'SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ("lat_pesantren", "lng_pesantren", "radius_absen")'
    );
    const settingsMap: Record<string, string> = {};
    settingRows.forEach(r => { settingsMap[r.nama_pengaturan] = r.nilai; });

    // Bersihkan format desimal koma (,) menjadi titik (.)
    const targetLatStr = (settingsMap['lat_pesantren'] || '').toString().replace(',', '.').trim();
    const targetLngStr = (settingsMap['lng_pesantren'] || '').toString().replace(',', '.').trim();
    const maxRadiusStr = (settingsMap['radius_absen'] || '').toString().replace(',', '.').trim();

    const targetLat = parseFloat(targetLatStr);
    const targetLng = parseFloat(targetLngStr);
    const maxRadius = parseFloat(maxRadiusStr);

    if (!isNaN(targetLat) && !isNaN(targetLng) && !isNaN(maxRadius) && maxRadius > 0) {
      const rawUserLat = body.lokasi_lat ?? body.lat ?? '';
      const rawUserLng = body.lokasi_lng ?? body.lng ?? '';

      const userLat = parseFloat(rawUserLat.toString().replace(',', '.').trim());
      const userLng = parseFloat(rawUserLng.toString().replace(',', '.').trim());

      if (isNaN(userLat) || isNaN(userLng)) {
        return NextResponse.json({
          error: 'Absensi Ditolak: Lokasi GPS HP/perangkat Anda belum diizinkan atau tidak terdeteksi. Aktifkan fitur lokasi (GPS) untuk melakukan absensi.'
        }, { status: 400 });
      }

      const distanceMeters = calculateDistanceMeters(userLat, userLng, targetLat, targetLng);
      if (distanceMeters > maxRadius) {
        const distText = distanceMeters >= 1000 
          ? `${(distanceMeters / 1000).toFixed(2)} km` 
          : `${Math.round(distanceMeters)} meter`;
        const radiusText = maxRadius >= 1000 
          ? `${(maxRadius / 1000).toFixed(2)} km` 
          : `${Math.round(maxRadius)} meter`;

        return NextResponse.json({
          error: `Absensi Ditolak: Jarak lokasi Anda (${distText}) berada di luar batas radius yang ditentukan (maksimal ${radiusText} dari titik lokasi pesantren).`
        }, { status: 400 });
      }
    }

    if (role === 'pengurus_asrama' || role === 'pengasuh') {
      if (!namaAsrama) {
        return NextResponse.json({ error: 'Akses ditolak: Asrama tidak terdefinisi' }, { status: 403 });
      }
      if (role === 'pengasuh' && (tipe === 'madin' || tipe === 'quran')) {
        return NextResponse.json({ error: 'Akses ditolak: Pengasuh hanya dapat mengakses absensi kegiatan pesantren' }, { status: 403 });
      }
      
      let kelas_id = null;
      if (tipe === 'madin') {
        const [rows] = await connection.execute<RowDataPacket[]>(
          'SELECT kelas_madin_id FROM jadwal_madin WHERE jadwal_id = ? LIMIT 1',
          [jadwal_id]
        );
        if (rows.length > 0) kelas_id = rows[0].kelas_madin_id;
        
        if (!kelas_id) return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
        
        const [check] = await connection.execute<RowDataPacket[]>(
          `SELECT 1 FROM murid m 
           JOIN kamar km ON m.kamar_id = km.kamar_id 
           WHERE km.nama_asrama = ? AND (m.kelas_madin_id = ? OR m.kelas_madin_2_id = ?) LIMIT 1`,
          [namaAsrama, kelas_id, kelas_id]
        );
        if (check.length === 0) {
          return NextResponse.json({ error: 'Akses ditolak: Kelas Madin ini tidak memiliki santri dari asrama Anda' }, { status: 403 });
        }
      } else if (tipe === 'quran') {
        const [rows] = await connection.execute<RowDataPacket[]>(
          'SELECT kelas_quran_id FROM jadwal_quran WHERE id = ? LIMIT 1',
          [jadwal_id]
        );
        if (rows.length > 0) kelas_id = rows[0].kelas_quran_id;
        
        if (!kelas_id) return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
        
        const [check] = await connection.execute<RowDataPacket[]>(
          `SELECT 1 FROM murid m 
           JOIN kamar km ON m.kamar_id = km.kamar_id 
           WHERE km.nama_asrama = ? AND m.kelas_quran_id = ?
           UNION
           SELECT 1 FROM kelas_quran
           WHERE nama_kelas LIKE ? AND id = ? LIMIT 1`,
          [namaAsrama, kelas_id, `%${namaAsrama}%`, kelas_id]
        );
        if (check.length === 0) {
          return NextResponse.json({ error: 'Akses ditolak: Kelas Qur\'an ini tidak memiliki santri dari asrama Anda' }, { status: 403 });
        }
      } else if (tipe === 'kegiatan') {
        const [rows] = await connection.execute<RowDataPacket[]>(
          'SELECT kamar_id FROM jadwal_kegiatan WHERE kegiatan_id = ? LIMIT 1',
          [jadwal_id]
        );
        if (rows.length > 0) kelas_id = rows[0].kamar_id;
        
        if (!kelas_id) return NextResponse.json({ error: 'Jadwal tidak ditemukan' }, { status: 404 });
        
        const [check] = await connection.execute<RowDataPacket[]>(
          `SELECT 1 FROM kamar WHERE nama_asrama = ? AND kamar_id = ? LIMIT 1`,
          [namaAsrama, kelas_id]
        );
        if (check.length === 0) {
          return NextResponse.json({ error: 'Akses ditolak: Kamar ini tidak termasuk asrama Anda' }, { status: 403 });
        }
      }
    }

    // Get today's date and time in Asia/Jakarta (WIB)
    const localISOTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentTime = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false });

    await connection.beginTransaction();

    let deleteQuery = '';
    let insertQuery = '';

    if (tipe === 'madin') {
      deleteQuery = 'DELETE FROM absensi WHERE jadwal_madin_id = ? AND tanggal = ?';
      insertQuery = 'INSERT INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)';
    } else if (tipe === 'quran') {
      deleteQuery = 'DELETE FROM absensi_quran WHERE jadwal_quran_id = ? AND tanggal = ?';
      insertQuery = 'INSERT INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)';
    } else if (tipe === 'kegiatan') {
      deleteQuery = 'DELETE FROM absensi_kegiatan WHERE kegiatan_id = ? AND tanggal = ?';
      insertQuery = 'INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)';
    }

    // Find all sibling schedule IDs in this class session (Team Teaching)
    let allSessionJadwalIds = [...targetJadwalIds];
    try {
      if (tipe === 'madin') {
        const [sibRows]: any = await connection.execute(
          `SELECT j2.jadwal_id 
           FROM jadwal_madin j1 
           JOIN jadwal_madin j2 ON j1.kelas_madin_id = j2.kelas_madin_id AND j1.hari = j2.hari
           WHERE j1.jadwal_id IN (${targetJadwalIds.map(() => '?').join(',')})`,
          targetJadwalIds
        );
        allSessionJadwalIds = Array.from(new Set([...allSessionJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      } else if (tipe === 'quran') {
        const [sibRows]: any = await connection.execute(
          `SELECT j2.id as jadwal_id 
           FROM jadwal_quran j1 
           JOIN jadwal_quran j2 ON j1.kelas_quran_id = j2.kelas_quran_id AND j1.hari = j2.hari
           WHERE j1.id IN (${targetJadwalIds.map(() => '?').join(',')})`,
          targetJadwalIds
        );
        allSessionJadwalIds = Array.from(new Set([...allSessionJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      } else if (tipe === 'kegiatan') {
        const [sibRows]: any = await connection.execute(
          `SELECT j2.kegiatan_id as jadwal_id 
           FROM jadwal_kegiatan j1 
           JOIN jadwal_kegiatan j2 ON j1.kamar_id = j2.kamar_id AND j1.hari = j2.hari
           WHERE j1.kegiatan_id IN (${targetJadwalIds.map(() => '?').join(',')})`,
          targetJadwalIds
        );
        allSessionJadwalIds = Array.from(new Set([...allSessionJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      }
    } catch (e) {
      console.warn('Find allSessionJadwalIds notice in input POST:', e);
    }

    // 1. Delete existing for today on all sibling schedules in this session to prevent duplication
    for (const sid of allSessionJadwalIds) {
      await connection.execute(deleteQuery, [sid, localISOTime]);
    }

    // 2. Insert new attendance & update nickname for target schedules
    for (const jId of targetJadwalIds) {
      for (const item of absensi) {
        await connection.execute(insertQuery, [
          jId,
          item.murid_id,
          localISOTime,
          item.status,
          item.keterangan || ''
        ]);

        if (item.nama_panggilan !== undefined) {
          await connection.execute(
            'UPDATE murid SET nama_panggilan = ? WHERE murid_id = ?',
            [item.nama_panggilan || null, item.murid_id]
          );
        }
      }

      // 3. Mark guru as Hadir (jika belum pernah tercatat hari ini)
      if (payload.role === 'guru' && payload.guruId) {
        try {
          const [guruAbsen] = await connection.execute<RowDataPacket[]>(
            `SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ?`,
            [payload.guruId, localISOTime]
          );
          if (guruAbsen.length === 0) {
            let insertGuru = '';
            if (tipe === 'madin') insertGuru = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id) VALUES (?, ?, "Hadir", "Menginput Absensi", 0, ?, ?) ON DUPLICATE KEY UPDATE status="Hadir"';
            else if (tipe === 'quran') insertGuru = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id) VALUES (?, ?, "Hadir", "Menginput Absensi", 0, ?, ?) ON DUPLICATE KEY UPDATE status="Hadir"';
            else if (tipe === 'kegiatan') insertGuru = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id) VALUES (?, ?, "Hadir", "Menginput Absensi", 0, ?, ?) ON DUPLICATE KEY UPDATE status="Hadir"';
            
            await connection.execute(insertGuru, [payload.guruId, localISOTime, currentTime, jId]);
          }
        } catch (guruErr) {
          console.warn('absensi_guru non-fatal notice:', guruErr);
        }
      }
    }

    await connection.commit();

    // Catat ke audit log (async, tidak blocking operasi utama)
    const tabelAbsen = tipe === 'madin' ? 'absensi' : tipe === 'quran' ? 'absensi_quran' : 'absensi_kegiatan';
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    logAudit({
      userId: payload.userId || null,
      userNama: payload.username || payload.name || '',
      userRole: payload.role || '',
      aksi: 'simpan_absen',
      tabel: tabelAbsen,
      recordId: parseInt(jadwal_id as string) || null,
      keterangan: `Input absen ${tipe} untuk ${absensi.length} santri, tanggal ${localISOTime}`,
      dataBaru: { jadwal_id, tipe, tanggal: localISOTime, jumlah: absensi.length },
      ipAddress: ipAddress.split(',')[0].trim(),
    });

    return NextResponse.json({ success: true, message: 'Absensi berhasil disimpan' });
  } catch (err: any) {
    await connection.rollback();
    return NextResponse.json({ error: 'Gagal menyimpan absensi: ' + err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}
