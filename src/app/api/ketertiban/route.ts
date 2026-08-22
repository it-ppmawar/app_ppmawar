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

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, muridId } = payload as any;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'izin';
    
    // Konfigurasi hak akses berbasis role
    let muridFilter = '1=1';
    let queryParams: any[] = [];

    if (role === 'guru') {
      if (guruId) {
        muridFilter = `(
          m.kelas_madin_id IN (SELECT kelas_id FROM kelas_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT id FROM kelas_quran WHERE guru_id = ?)
          OR m.kamar_id IN (SELECT kamar_id FROM kamar WHERE guru_id = ?)
          OR m.kelas_madin_id IN (SELECT kelas_madin_id FROM jadwal_madin WHERE guru_id = ?)
          OR m.kelas_quran_id IN (SELECT kelas_quran_id FROM jadwal_quran WHERE guru_id = ?)
        )`;
        queryParams = [guruId, guruId, guruId, guruId, guruId];
      } else {
        muridFilter = '0=1';
      }
    } else if (role === 'pengurus_asrama' || role === 'pengasuh') {
      // Resolve nama asrama untuk pengurus
      const { userId, username } = payload as any;
      const tokenAsrama = (payload as any).namaAsrama || null;
      const { resolveAsrama } = await import('@/lib/auth/resolveAsrama');
      const namaAsrama = await resolveAsrama(userId, role, username || '', tokenAsrama);

      if (namaAsrama) {
        // Tampilkan ketertiban santri yang kamarnya ada di asramanya
        muridFilter = `m.kamar_id IN (SELECT kamar_id FROM kamar WHERE nama_asrama = ?)`;
        queryParams = [namaAsrama];
      } else {
        muridFilter = '0=1';
      }
    } else if (role !== 'admin' && role !== 'staff') {
      if (muridId) {
        muridFilter = `m.murid_id = ?`;
        queryParams = [muridId];
      } else {
        muridFilter = '0=1';
      }
    }

    // Hitung ringkasan total (Izin, Alpa, Pelanggaran)
    const [countIzinRows] = await pool.execute<RowDataPacket[]>(`
      SELECT (
        (SELECT COUNT(*) FROM absensi a JOIN murid m ON a.murid_id = m.murid_id WHERE LOWER(a.status) IN ('izin', 'sakit') AND ${muridFilter}) +
        (SELECT COUNT(*) FROM absensi_quran aq JOIN murid m ON aq.murid_id = m.murid_id WHERE LOWER(aq.status) IN ('izin', 'sakit') AND ${muridFilter}) +
        (SELECT COUNT(*) FROM absensi_kegiatan ak JOIN murid m ON ak.murid_id = m.murid_id WHERE LOWER(ak.status) IN ('izin', 'sakit') AND ${muridFilter}) +
        (SELECT COUNT(*) FROM pelanggaran p JOIN murid m ON p.murid_id = m.murid_id WHERE (LOWER(p.jenis) LIKE '%izin%' OR LOWER(p.jenis) LIKE '%sakit%') AND ${muridFilter})
      ) as total
    `, [...queryParams, ...queryParams, ...queryParams, ...queryParams]);

    const [countAlpaRows] = await pool.execute<RowDataPacket[]>(`
      SELECT (
        (SELECT COUNT(*) FROM absensi a JOIN murid m ON a.murid_id = m.murid_id WHERE LOWER(a.status) IN ('alpha', 'alpa') AND ${muridFilter}) +
        (SELECT COUNT(*) FROM absensi_quran aq JOIN murid m ON aq.murid_id = m.murid_id WHERE LOWER(aq.status) IN ('alpha', 'alpa') AND ${muridFilter}) +
        (SELECT COUNT(*) FROM absensi_kegiatan ak JOIN murid m ON ak.murid_id = m.murid_id WHERE LOWER(ak.status) IN ('alpha', 'alpa') AND ${muridFilter}) +
        (SELECT COUNT(*) FROM pelanggaran p JOIN murid m ON p.murid_id = m.murid_id WHERE (LOWER(p.jenis) LIKE '%alpa%' OR LOWER(p.jenis) LIKE '%alpha%' OR LOWER(p.jenis) LIKE '%tidak hadir%') AND ${muridFilter})
      ) as total
    `, [...queryParams, ...queryParams, ...queryParams, ...queryParams]);

    const [countPelanggaranRows] = await pool.execute<RowDataPacket[]>(`
      SELECT COUNT(*) as total 
      FROM pelanggaran p 
      JOIN murid m ON p.murid_id = m.murid_id 
      WHERE LOWER(p.jenis) NOT LIKE '%alpa%' 
        AND LOWER(p.jenis) NOT LIKE '%alpha%' 
        AND LOWER(p.jenis) NOT LIKE '%hadir%' 
        AND LOWER(p.jenis) NOT LIKE '%izin%' 
        AND LOWER(p.jenis) NOT LIKE '%sakit%' 
        AND LOWER(p.jenis) NOT LIKE '%tidak hadir%' 
        AND ${muridFilter}
    `, queryParams);

    const summary = {
      totalIzin: Number(countIzinRows[0]?.total || 0),
      totalAlpa: Number(countAlpaRows[0]?.total || 0),
      totalPelanggaran: Number(countPelanggaranRows[0]?.total || 0),
    };

    if (tab === 'izin') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT CONCAT('madin_', a.murid_id, '_', a.tanggal) as id, m.murid_id, m.nama, m.jenis_kelamin, a.tanggal, 
                CONCAT('Madin: ', IFNULL(NULLIF(a.keterangan, ''), a.status)) as keterangan, 
                a.status as status, 'absensi_madin' as sumber 
         FROM absensi a 
         JOIN murid m ON a.murid_id = m.murid_id 
         WHERE LOWER(a.status) IN ('izin', 'sakit') AND ${muridFilter}

         UNION ALL

         SELECT CONCAT('quran_', aq.murid_id, '_', aq.tanggal) as id, m.murid_id, m.nama, m.jenis_kelamin, aq.tanggal, 
                CONCAT('Qur\\'an: ', IFNULL(NULLIF(aq.keterangan, ''), aq.status)) as keterangan, 
                aq.status as status, 'absensi_quran' as sumber 
         FROM absensi_quran aq 
         JOIN murid m ON aq.murid_id = m.murid_id 
         WHERE LOWER(aq.status) IN ('izin', 'sakit') AND ${muridFilter}

         UNION ALL

         SELECT CONCAT('kegiatan_', ak.murid_id, '_', ak.tanggal) as id, m.murid_id, m.nama, m.jenis_kelamin, ak.tanggal, 
                CONCAT('Asrama: ', IFNULL(NULLIF(ak.keterangan, ''), ak.status)) as keterangan, 
                ak.status as status, 'absensi_kegiatan' as sumber 
         FROM absensi_kegiatan ak 
         JOIN murid m ON ak.murid_id = m.murid_id 
         WHERE LOWER(ak.status) IN ('izin', 'sakit') AND ${muridFilter}

         UNION ALL

         SELECT CAST(p.pelanggaran_id AS CHAR) as id, m.murid_id, m.nama, m.jenis_kelamin, p.tanggal, 
                IFNULL(NULLIF(p.deskripsi, ''), p.jenis) as keterangan, 
                p.jenis as status, 'pelanggaran' as sumber 
         FROM pelanggaran p 
         JOIN murid m ON p.murid_id = m.murid_id 
         WHERE (LOWER(p.jenis) LIKE '%izin%' OR LOWER(p.jenis) LIKE '%sakit%') AND ${muridFilter}

         ORDER BY tanggal DESC
         LIMIT 100`,
        [...queryParams, ...queryParams, ...queryParams, ...queryParams]
      );

      const dataIzin = rows.map(r => ({
        id: r.id,
        murid_id: r.murid_id,
        nama: r.nama,
        jenis_kelamin: r.jenis_kelamin || '-',
        kelas: '-',
        tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        raw_tanggal: r.tanggal,
        keterangan: r.keterangan || r.status,
        status: r.status,
        sumber: r.sumber,
        ditindak: true
      }));

      return NextResponse.json({ success: true, data: dataIzin, summary });

    } else if (tab === 'alpa') {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT CONCAT('madin_', a.murid_id, '_', a.tanggal) as id, m.murid_id, m.nama, m.jenis_kelamin, a.tanggal, 
                CONCAT('Madin: ', IFNULL(NULLIF(a.keterangan, ''), 'Tidak hadir tanpa keterangan')) as keterangan, 
                a.status as status, 'absensi_madin' as sumber 
         FROM absensi a 
         JOIN murid m ON a.murid_id = m.murid_id 
         WHERE LOWER(a.status) IN ('alpha', 'alpa') AND ${muridFilter}

         UNION ALL

         SELECT CONCAT('quran_', aq.murid_id, '_', aq.tanggal) as id, m.murid_id, m.nama, m.jenis_kelamin, aq.tanggal, 
                CONCAT('Qur\\'an: ', IFNULL(NULLIF(aq.keterangan, ''), 'Tidak hadir tanpa keterangan')) as keterangan, 
                aq.status as status, 'absensi_quran' as sumber 
         FROM absensi_quran aq 
         JOIN murid m ON aq.murid_id = m.murid_id 
         WHERE LOWER(aq.status) IN ('alpha', 'alpa') AND ${muridFilter}

         UNION ALL

         SELECT CONCAT('kegiatan_', ak.murid_id, '_', ak.tanggal) as id, m.murid_id, m.nama, m.jenis_kelamin, ak.tanggal, 
                CONCAT('Asrama: ', IFNULL(NULLIF(ak.keterangan, ''), 'Tidak hadir tanpa keterangan')) as keterangan, 
                ak.status as status, 'absensi_kegiatan' as sumber 
         FROM absensi_kegiatan ak 
         JOIN murid m ON ak.murid_id = m.murid_id 
         WHERE LOWER(ak.status) IN ('alpha', 'alpa') AND ${muridFilter}

         UNION ALL

         SELECT CAST(p.pelanggaran_id AS CHAR) as id, m.murid_id, m.nama, m.jenis_kelamin, p.tanggal, 
                IFNULL(NULLIF(p.deskripsi, ''), p.jenis) as keterangan, 
                p.jenis as status, 'pelanggaran' as sumber 
         FROM pelanggaran p 
         JOIN murid m ON p.murid_id = m.murid_id 
         WHERE (LOWER(p.jenis) LIKE '%alpa%' OR LOWER(p.jenis) LIKE '%alpha%' OR LOWER(p.jenis) LIKE '%tidak hadir%') AND ${muridFilter}

         ORDER BY tanggal DESC
         LIMIT 100`,
        [...queryParams, ...queryParams, ...queryParams, ...queryParams]
      );
      
      const dataAlpa = rows.map(r => ({
        id: r.id,
        murid_id: r.murid_id,
        nama: r.nama,
        jenis_kelamin: r.jenis_kelamin || '-',
        kelas: '-',
        tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        raw_tanggal: r.tanggal,
        keterangan: r.keterangan || r.status,
        status: r.status,
        sumber: r.sumber,
        ditindak: true
      }));

      return NextResponse.json({ success: true, data: dataAlpa, summary });

    } else {
      // Tab 'pelanggaran' (Pelanggaran Tata Tertib Kedisiplinan Lainnya)
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT CAST(p.pelanggaran_id AS CHAR) as id, m.murid_id, m.nama as nama, m.jenis_kelamin as jenis_kelamin,
                p.tanggal, p.jenis as jenis, p.deskripsi, 'pelanggaran' as sumber 
         FROM pelanggaran p
         JOIN murid m ON p.murid_id = m.murid_id
         WHERE LOWER(p.jenis) NOT LIKE '%alpa%' 
           AND LOWER(p.jenis) NOT LIKE '%alpha%' 
           AND LOWER(p.jenis) NOT LIKE '%hadir%' 
           AND LOWER(p.jenis) NOT LIKE '%izin%' 
           AND LOWER(p.jenis) NOT LIKE '%sakit%' 
           AND LOWER(p.jenis) NOT LIKE '%tidak hadir%'
           AND (${muridFilter})
         ORDER BY p.tanggal DESC
         LIMIT 100`,
        queryParams
      );

      const dataPelanggaran = rows.map(r => ({
        id: r.id,
        murid_id: r.murid_id,
        nama: r.nama,
        jenis_kelamin: r.jenis_kelamin || '-',
        kelas: '-',
        tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        raw_tanggal: r.tanggal,
        jenis: r.jenis,
        keterangan: r.deskripsi || r.jenis,
        deskripsi: r.deskripsi,
        sumber: r.sumber,
        poin: 0,
        ditindak: true
      }));

      return NextResponse.json({ success: true, data: dataPelanggaran, summary });
    }
  } catch (error: any) {
    console.error('Error API Ketertiban:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sumber = searchParams.get('sumber') || 'pelanggaran';
    const murid_id = searchParams.get('murid_id');
    const tanggal = searchParams.get('tanggal');
    
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    if (sumber === 'absensi_madin' && murid_id && tanggal) {
      await pool.execute('DELETE FROM absensi WHERE murid_id = ? AND tanggal = ?', [murid_id, tanggal]);
    } else if (sumber === 'absensi_quran' && murid_id && tanggal) {
      await pool.execute('DELETE FROM absensi_quran WHERE murid_id = ? AND tanggal = ?', [murid_id, tanggal]);
    } else if (sumber === 'absensi_kegiatan' && murid_id && tanggal) {
      await pool.execute('DELETE FROM absensi_kegiatan WHERE murid_id = ? AND tanggal = ?', [murid_id, tanggal]);
    } else {
      await pool.execute('DELETE FROM pelanggaran WHERE pelanggaran_id = ?', [id]);
    }

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload as any;
    const allowed = ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'guru'];
    if (!allowed.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { murid_id, jenis, deskripsi, tanggal } = body;

    if (!murid_id || !jenis || !tanggal) {
      return NextResponse.json({ error: 'Field murid_id, jenis, dan tanggal wajib diisi' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO pelanggaran (murid_id, jenis, deskripsi, tanggal) VALUES (?, ?, ?, ?)',
      [murid_id, jenis, deskripsi || '', tanggal]
    );

    return NextResponse.json({ success: true, message: 'Data pelanggaran berhasil ditambahkan' });
  } catch (error: any) {
    console.error('POST Ketertiban Error:', error.message);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload as any;
    const allowed = ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'guru'];
    if (!allowed.includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { id, jenis, deskripsi, tanggal } = body;
    
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    await pool.execute(
      'UPDATE pelanggaran SET jenis = ?, deskripsi = ?, tanggal = ? WHERE pelanggaran_id = ?',
      [jenis, deskripsi, tanggal, id]
    );
    return NextResponse.json({ success: true, message: 'Data berhasil diubah' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
