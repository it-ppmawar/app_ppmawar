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

    if (role === 'pengurus_asrama') {
      if (!namaAsrama) {
        return NextResponse.json({ error: 'Akses ditolak: Asrama tidak terdefinisi' }, { status: 403 });
      }
      if (tipe === 'madin') {
        const [check] = await pool.execute<RowDataPacket[]>(
          `SELECT 1 FROM murid m 
           JOIN kamar km ON m.kamar_id = km.kamar_id 
           WHERE km.nama_asrama = ? AND m.kelas_madin_id = ? LIMIT 1`,
          [namaAsrama, kelas_id]
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

    if (role === 'pengurus_asrama' && namaAsrama) {
      // Pengurus asrama hanya melihat santri dari asrama mereka sendiri
      if (tipe === 'madin') {
        query = `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.alamat FROM murid m
          JOIN kamar km ON m.kamar_id = km.kamar_id
          WHERE m.kelas_madin_id = ? AND km.nama_asrama = ? ORDER BY m.nama ASC`;
        params = [kelas_id, namaAsrama];
      } else if (tipe === 'quran') {
        query = `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.alamat FROM murid m
          JOIN kamar km ON m.kamar_id = km.kamar_id
          WHERE m.kelas_quran_id = ? AND km.nama_asrama = ? ORDER BY m.nama ASC`;
        params = [kelas_id, namaAsrama];
      } else if (tipe === 'kegiatan') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat FROM murid WHERE kamar_id = ? ORDER BY nama ASC';
      } else {
        return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
      }
    } else {
      if (tipe === 'madin') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat FROM murid WHERE kelas_madin_id = ? ORDER BY nama ASC';
      } else if (tipe === 'quran') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat FROM murid WHERE kelas_quran_id = ? ORDER BY nama ASC';
      } else if (tipe === 'kegiatan') {
        query = 'SELECT murid_id, nis, nama, nama_panggilan, foto, alamat FROM murid WHERE kamar_id = ? ORDER BY nama ASC';
      } else {
        return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
      }
    }

    const [murid] = await pool.execute<RowDataPacket[]>(query, params);

    // Get today's date in YYYY-MM-DD
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);

    // Fetch existing attendance if any
    let existingQuery = '';
    let existingParams = [jadwal_id, localISOTime];

    if (tipe === 'madin') existingQuery = 'SELECT murid_id, status, keterangan FROM absensi WHERE jadwal_madin_id = ? AND tanggal = ?';
    else if (tipe === 'quran') existingQuery = 'SELECT murid_id, status, keterangan FROM absensi_quran WHERE jadwal_quran_id = ? AND tanggal = ?';
    else if (tipe === 'kegiatan') existingQuery = 'SELECT murid_id, status, keterangan FROM absensi_kegiatan WHERE kegiatan_id = ? AND tanggal = ?';

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
    return NextResponse.json({ success: true, data: mappedMurid, namaTarget, sudah_absen });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
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
    const { tipe, jadwal_id, absensi } = body;

    if (!tipe || !jadwal_id || !absensi || !Array.isArray(absensi)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
    }

    const { role, userId, username } = payload;
    const tokenAsrama = payload.namaAsrama || null;
    const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
    const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

    if (role === 'pengurus_asrama') {
      if (!namaAsrama) {
        return NextResponse.json({ error: 'Akses ditolak: Asrama tidak terdefinisi' }, { status: 403 });
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
           WHERE km.nama_asrama = ? AND m.kelas_madin_id = ? LIMIT 1`,
          [namaAsrama, kelas_id]
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

    // Get today's date in YYYY-MM-DD
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    const currentTime = (new Date(Date.now() - tzOffset)).toISOString().slice(11, 19);

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

    // 1. Delete existing for today
    await connection.execute(deleteQuery, [jadwal_id, localISOTime]);

    // 2. Insert new & update nickname
    for (const item of absensi) {
      await connection.execute(insertQuery, [
        jadwal_id,
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

    // 3. Mark guru as Hadir (jika belum)
    if (payload.role === 'guru' && payload.guruId) {
      // Check if already exist
      const [guruAbsen] = await connection.execute<RowDataPacket[]>(
        `SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ? AND ${tipe === 'madin' ? 'jadwal_madin_id' : tipe === 'quran' ? 'jadwal_quran_id' : 'kegiatan_id'} = ?`,
        [payload.guruId, localISOTime, jadwal_id]
      );
      if (guruAbsen.length === 0) {
        let insertGuru = '';
        if (tipe === 'madin') insertGuru = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id) VALUES (?, ?, "Hadir", "Menginput Absensi", 0, ?, ?)';
        else if (tipe === 'quran') insertGuru = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id) VALUES (?, ?, "Hadir", "Menginput Absensi", 0, ?, ?)';
        else if (tipe === 'kegiatan') insertGuru = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id) VALUES (?, ?, "Hadir", "Menginput Absensi", 0, ?, ?)';
        
        await connection.execute(insertGuru, [payload.guruId, localISOTime, currentTime, jadwal_id]);
      }
    }

    await connection.commit();
    return NextResponse.json({ success: true, message: 'Absensi berhasil disimpan' });
  } catch (err: any) {
    await connection.rollback();
    return NextResponse.json({ error: 'Gagal menyimpan absensi: ' + err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}
