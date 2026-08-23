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

    // ─── Hitung ringkasan total (Izin, Sakit, Alpa, Pelanggaran) secara aman & terisolasi ───
    const [
      madinIzinRes,
      madinSakitRes,
      quranIzinRes,
      quranSakitRes,
      kegiatanIzinRes,
      kegiatanSakitRes,
      pelanggaranIzinRes,
      pelanggaranSakitRes,
      madinAlpaRes,
      quranAlpaRes,
      kegiatanAlpaRes,
      pelanggaranAlpaRes,
      pelanggaranLainRes,
    ] = await Promise.all([
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi a JOIN murid m ON a.murid_id = m.murid_id WHERE LOWER(a.status) = 'izin' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi a JOIN murid m ON a.murid_id = m.murid_id WHERE LOWER(a.status) = 'sakit' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi_quran aq JOIN murid m ON aq.murid_id = m.murid_id WHERE LOWER(aq.status) = 'izin' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi_quran aq JOIN murid m ON aq.murid_id = m.murid_id WHERE LOWER(aq.status) = 'sakit' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi_kegiatan ak JOIN murid m ON ak.murid_id = m.murid_id WHERE LOWER(ak.status) = 'izin' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi_kegiatan ak JOIN murid m ON ak.murid_id = m.murid_id WHERE LOWER(ak.status) = 'sakit' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM pelanggaran p JOIN murid m ON p.murid_id = m.murid_id WHERE LOWER(p.jenis) LIKE '%izin%' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM pelanggaran p JOIN murid m ON p.murid_id = m.murid_id WHERE LOWER(p.jenis) LIKE '%sakit%' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi a JOIN murid m ON a.murid_id = m.murid_id WHERE LOWER(a.status) IN ('alpha', 'alpa') AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi_quran aq JOIN murid m ON aq.murid_id = m.murid_id WHERE LOWER(aq.status) IN ('alpha', 'alpa') AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM absensi_kegiatan ak JOIN murid m ON ak.murid_id = m.murid_id WHERE LOWER(ak.status) IN ('alpha', 'alpa') AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM pelanggaran p JOIN murid m ON p.murid_id = m.murid_id WHERE (LOWER(p.jenis) LIKE '%alpa%' OR LOWER(p.jenis) LIKE '%alpha%' OR LOWER(p.jenis) LIKE '%tidak hadir%') AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
      pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as c FROM pelanggaran p JOIN murid m ON p.murid_id = m.murid_id WHERE LOWER(p.jenis) NOT LIKE '%alpa%' AND LOWER(p.jenis) NOT LIKE '%alpha%' AND LOWER(p.jenis) NOT LIKE '%hadir%' AND LOWER(p.jenis) NOT LIKE '%izin%' AND LOWER(p.jenis) NOT LIKE '%sakit%' AND LOWER(p.jenis) NOT LIKE '%tidak hadir%' AND ${muridFilter}`, queryParams).catch(() => [[{ c: 0 }]] as any),
    ]);

    const totalIzin = (Number(madinIzinRes[0]?.[0]?.c) || 0) + (Number(quranIzinRes[0]?.[0]?.c) || 0) + (Number(kegiatanIzinRes[0]?.[0]?.c) || 0) + (Number(pelanggaranIzinRes[0]?.[0]?.c) || 0);
    const totalSakit = (Number(madinSakitRes[0]?.[0]?.c) || 0) + (Number(quranSakitRes[0]?.[0]?.c) || 0) + (Number(kegiatanSakitRes[0]?.[0]?.c) || 0) + (Number(pelanggaranSakitRes[0]?.[0]?.c) || 0);
    const totalAlpa = (Number(madinAlpaRes[0]?.[0]?.c) || 0) + (Number(quranAlpaRes[0]?.[0]?.c) || 0) + (Number(kegiatanAlpaRes[0]?.[0]?.c) || 0) + (Number(pelanggaranAlpaRes[0]?.[0]?.c) || 0);
    const totalPelanggaran = Number(pelanggaranLainRes[0]?.[0]?.c) || 0;

    const summary = {
      totalIzin,
      totalSakit,
      totalAlpa,
      totalPelanggaran,
    };

    if (tab === 'izin' || tab === 'sakit') {
      const statusFilter = tab === 'izin' ? "LOWER(a.status) = 'izin'" : "LOWER(a.status) = 'sakit'";
      const statusFilterQ = tab === 'izin' ? "LOWER(aq.status) = 'izin'" : "LOWER(aq.status) = 'sakit'";
      const statusFilterK = tab === 'izin' ? "LOWER(ak.status) = 'izin'" : "LOWER(ak.status) = 'sakit'";
      const statusFilterP = tab === 'izin' ? "LOWER(p.jenis) LIKE '%izin%'" : "LOWER(p.jenis) LIKE '%sakit%'";

      const [madinRows, quranRows, kegiatanRows, pelanggaranRows] = await Promise.all([
        pool.execute<RowDataPacket[]>(
          `SELECT a.murid_id, m.nama, m.jenis_kelamin, a.tanggal, a.keterangan, a.status,
                  COALESCE(km.nama_kelas, '-') as kelas_nama
           FROM absensi a 
           JOIN murid m ON a.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           WHERE ${statusFilter} AND ${muridFilter} 
           ORDER BY a.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),

        pool.execute<RowDataPacket[]>(
          `SELECT aq.murid_id, m.nama, m.jenis_kelamin, aq.tanggal, aq.keterangan, aq.status,
                  COALESCE(kq.nama_kelas, '-') as kelas_nama
           FROM absensi_quran aq 
           JOIN murid m ON aq.murid_id = m.murid_id 
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE ${statusFilterQ} AND ${muridFilter} 
           ORDER BY aq.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),

        pool.execute<RowDataPacket[]>(
          `SELECT ak.murid_id, m.nama, m.jenis_kelamin, ak.tanggal, ak.keterangan, ak.status,
                  COALESCE(ka.nama_kamar, '-') as kelas_nama
           FROM absensi_kegiatan ak 
           JOIN murid m ON ak.murid_id = m.murid_id 
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE ${statusFilterK} AND ${muridFilter} 
           ORDER BY ak.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),

        pool.execute<RowDataPacket[]>(
          `SELECT p.pelanggaran_id, p.murid_id, m.nama, m.jenis_kelamin, p.tanggal, p.deskripsi as keterangan, p.jenis as status,
                  COALESCE(km.nama_kelas, kq.nama_kelas, ka.nama_kamar, '-') as kelas_nama
           FROM pelanggaran p 
           JOIN murid m ON p.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE ${statusFilterP} AND ${muridFilter} 
           ORDER BY p.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),
      ]);

      const combinedData = [
        ...((madinRows[0] || []) as any[]).map(r => ({
          id: `madin_${r.murid_id}_${r.tanggal}`,
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || 'Madin',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan ? `Madin: ${r.keterangan}` : `Madin (${r.status})`,
          status: r.status,
          sumber: 'absensi_madin',
          kategori: 'madin',
          ditindak: true,
        })),
        ...((quranRows[0] || []) as any[]).map(r => ({
          id: `quran_${r.murid_id}_${r.tanggal}`,
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || 'Qur\'an',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan ? `Qur'an: ${r.keterangan}` : `Qur'an (${r.status})`,
          status: r.status,
          sumber: 'absensi_quran',
          kategori: 'quran',
          ditindak: true,
        })),
        ...((kegiatanRows[0] || []) as any[]).map(r => ({
          id: `kegiatan_${r.murid_id}_${r.tanggal}`,
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || 'Asrama',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan ? `Asrama: ${r.keterangan}` : `Asrama (${r.status})`,
          status: r.status,
          sumber: 'absensi_kegiatan',
          kategori: 'kegiatan',
          ditindak: true,
        })),
        ...((pelanggaranRows[0] || []) as any[]).map(r => ({
          id: String(r.pelanggaran_id),
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || '-',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan || r.status,
          status: r.status,
          sumber: 'pelanggaran',
          kategori: 'lainnya',
          ditindak: true,
        })),
      ].sort((a, b) => new Date(b.raw_tanggal).getTime() - new Date(a.raw_tanggal).getTime());

      return NextResponse.json({ success: true, data: combinedData, summary });

    } else if (tab === 'alpa') {
      const [madinRows, quranRows, kegiatanRows, pelanggaranRows] = await Promise.all([
        pool.execute<RowDataPacket[]>(
          `SELECT a.murid_id, m.nama, m.jenis_kelamin, a.tanggal, a.keterangan, a.status,
                  COALESCE(km.nama_kelas, '-') as kelas_nama
           FROM absensi a 
           JOIN murid m ON a.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           WHERE LOWER(a.status) IN ('alpha', 'alpa') AND ${muridFilter} 
           ORDER BY a.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),

        pool.execute<RowDataPacket[]>(
          `SELECT aq.murid_id, m.nama, m.jenis_kelamin, aq.tanggal, aq.keterangan, aq.status,
                  COALESCE(kq.nama_kelas, '-') as kelas_nama
           FROM absensi_quran aq 
           JOIN murid m ON aq.murid_id = m.murid_id 
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE LOWER(aq.status) IN ('alpha', 'alpa') AND ${muridFilter} 
           ORDER BY aq.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),

        pool.execute<RowDataPacket[]>(
          `SELECT ak.murid_id, m.nama, m.jenis_kelamin, ak.tanggal, ak.keterangan, ak.status,
                  COALESCE(ka.nama_kamar, '-') as kelas_nama
           FROM absensi_kegiatan ak 
           JOIN murid m ON ak.murid_id = m.murid_id 
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE LOWER(ak.status) IN ('alpha', 'alpa') AND ${muridFilter} 
           ORDER BY ak.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),

        pool.execute<RowDataPacket[]>(
          `SELECT p.pelanggaran_id, p.murid_id, m.nama, m.jenis_kelamin, p.tanggal, p.deskripsi as keterangan, p.jenis as status,
                  COALESCE(km.nama_kelas, kq.nama_kelas, ka.nama_kamar, '-') as kelas_nama
           FROM pelanggaran p 
           JOIN murid m ON p.murid_id = m.murid_id 
           LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
           WHERE (LOWER(p.jenis) LIKE '%alpa%' OR LOWER(p.jenis) LIKE '%alpha%' OR LOWER(p.jenis) LIKE '%tidak hadir%') AND ${muridFilter} 
           ORDER BY p.tanggal DESC LIMIT 200`,
          queryParams
        ).catch(() => [[] as RowDataPacket[]]),
      ]);

      const combinedAlpa = [
        ...((madinRows[0] || []) as any[]).map(r => ({
          id: `madin_${r.murid_id}_${r.tanggal}`,
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || 'Madin',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan ? `Madin: ${r.keterangan}` : 'Madin (Alpa / Tidak Hadir)',
          status: r.status,
          sumber: 'absensi_madin',
          kategori: 'madin',
          ditindak: true,
        })),
        ...((quranRows[0] || []) as any[]).map(r => ({
          id: `quran_${r.murid_id}_${r.tanggal}`,
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || 'Qur\'an',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan ? `Qur'an: ${r.keterangan}` : `Qur'an (Alpa / Tidak Hadir)`,
          status: r.status,
          sumber: 'absensi_quran',
          kategori: 'quran',
          ditindak: true,
        })),
        ...((kegiatanRows[0] || []) as any[]).map(r => ({
          id: `kegiatan_${r.murid_id}_${r.tanggal}`,
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || 'Asrama',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan ? `Asrama: ${r.keterangan}` : `Asrama (Alpa / Tidak Hadir)`,
          status: r.status,
          sumber: 'absensi_kegiatan',
          kategori: 'kegiatan',
          ditindak: true,
        })),
        ...((pelanggaranRows[0] || []) as any[]).map(r => ({
          id: String(r.pelanggaran_id),
          murid_id: r.murid_id,
          nama: r.nama,
          jenis_kelamin: r.jenis_kelamin || '-',
          kelas: r.kelas_nama || '-',
          tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          raw_tanggal: r.tanggal,
          keterangan: r.keterangan || r.status,
          status: r.status,
          sumber: 'pelanggaran',
          kategori: 'lainnya',
          ditindak: true,
        })),
      ].sort((a, b) => new Date(b.raw_tanggal).getTime() - new Date(a.raw_tanggal).getTime());

      return NextResponse.json({ success: true, data: combinedAlpa, summary });

    } else {
      // Tab 'pelanggaran' (Pelanggaran Tata Tertib Kedisiplinan Lainnya)
      const [pelanggaranRows] = await pool.execute<RowDataPacket[]>(
        `SELECT p.pelanggaran_id, p.murid_id, m.nama as nama, m.jenis_kelamin as jenis_kelamin,
                p.tanggal, p.jenis as jenis, p.deskripsi, 'pelanggaran' as sumber,
                COALESCE(km.nama_kelas, kq.nama_kelas, ka.nama_kamar, '-') as kelas_nama
         FROM pelanggaran p
         JOIN murid m ON p.murid_id = m.murid_id
         LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
         LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
         LEFT JOIN kamar ka ON m.kamar_id = ka.kamar_id
         WHERE LOWER(p.jenis) NOT LIKE '%alpa%' 
           AND LOWER(p.jenis) NOT LIKE '%alpha%' 
           AND LOWER(p.jenis) NOT LIKE '%hadir%' 
           AND LOWER(p.jenis) NOT LIKE '%izin%' 
           AND LOWER(p.jenis) NOT LIKE '%sakit%' 
           AND LOWER(p.jenis) NOT LIKE '%tidak hadir%'
           AND (${muridFilter})
         ORDER BY p.tanggal DESC
         LIMIT 200`,
        queryParams
      ).catch(() => [[] as RowDataPacket[]]);

      const dataPelanggaran = ((pelanggaranRows || []) as any[]).map(r => ({
        id: String(r.pelanggaran_id),
        murid_id: r.murid_id,
        nama: r.nama,
        jenis_kelamin: r.jenis_kelamin || '-',
        kelas: r.kelas_nama || '-',
        tanggal: new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        raw_tanggal: r.tanggal,
        jenis: r.jenis,
        keterangan: r.deskripsi || r.jenis,
        deskripsi: r.deskripsi,
        sumber: 'pelanggaran',
        kategori: 'lainnya',
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
