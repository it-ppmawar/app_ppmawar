import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload;
    // Hanya admin, staff, dan pengurus_asrama yang bisa trigger auto-alpha
    if (!['admin', 'staff', 'pengurus_asrama'].includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak. Fitur ini hanya untuk Admin/Staff/Pengurus.' }, { status: 403 });
    }

    const nowObj = new Date();
    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(nowObj);
    const nowTime = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false });
    const rawDay = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(nowObj);
    const hariDB = rawDay === 'Minggu' ? 'Ahad' : rawDay;

    const parseTimeToSec = (tStr: string) => {
      const [h, m, s] = String(tStr).split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };
    const nowSecs = parseTimeToSec(nowTime);

    // Ambil semua pengaturan auto-alpha sekaligus
    const [allSettingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis 
       WHERE nama_pengaturan IN ('waktu_tenggang_absensi', 'absensi_otomatis_guru', 
       'absensi_otomatis_madin', 'absensi_otomatis_quran', 'absensi_otomatis_kegiatan')`
    );
    const settingsMap: Record<string, string> = {};
    for (const row of allSettingRows) {
      settingsMap[row.nama_pengaturan] = row.nilai;
    }

    const waktuTenggangJam = settingsMap['waktu_tenggang_absensi'] && !isNaN(parseFloat(settingsMap['waktu_tenggang_absensi']))
      ? parseFloat(settingsMap['waktu_tenggang_absensi'])
      : 2;
    const tenggangSecs = waktuTenggangJam * 3600;

    // Master toggle: apakah auto-alpha guru diaktifkan sama sekali
    const isAutoAlphaGuruMaster = !settingsMap['absensi_otomatis_guru'] || settingsMap['absensi_otomatis_guru'] === '1' || settingsMap['absensi_otomatis_guru'] === 'true';
    // Per-kategori toggles (default: aktif jika master aktif dan belum pernah diset)
    const isAutoAlphaMadin = isAutoAlphaGuruMaster && (!settingsMap['absensi_otomatis_madin'] || settingsMap['absensi_otomatis_madin'] === '1' || settingsMap['absensi_otomatis_madin'] === 'true');
    const isAutoAlphaQuran = isAutoAlphaGuruMaster && (!settingsMap['absensi_otomatis_quran'] || settingsMap['absensi_otomatis_quran'] === '1' || settingsMap['absensi_otomatis_quran'] === 'true');
    const isAutoAlphaKegiatan = isAutoAlphaGuruMaster && (!settingsMap['absensi_otomatis_kegiatan'] || settingsMap['absensi_otomatis_kegiatan'] === '1' || settingsMap['absensi_otomatis_kegiatan'] === 'true');

    const hasil: { tipe: string; jadwal_id: number; nama: string; jumlah_ditandai: number; guru_alpha: boolean }[] = [];
    let totalDitandai = 0;
    let totalGuruDitandai = 0;

    await connection.beginTransaction();

    // ===== 1. JADWAL MADIN =====
    const [madinJadwal] = await connection.execute<RowDataPacket[]>(
      `SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.kelas_madin_id, km.nama_kelas, j.guru_id
       FROM jadwal_madin j
       JOIN kelas_madin km ON j.kelas_madin_id = km.kelas_id
       WHERE j.hari = ?`,
      [hariDB]
    );
    for (const jadwal of madinJadwal) {
      const selesaiSecs = parseTimeToSec(jadwal.jam_selesai);
      const lateSecs = selesaiSecs + tenggangSecs;
      // Hanya jadwal yang sudah lewat waktu toleransi
      if (nowSecs <= lateSecs) continue;

      let guruMarked = false;
      // 1.1 Catat Alpha untuk Guru jika belum ada presensi apapun hari ini (Hadir/Izin/Sakit)
      // Cek: ada record jadwal spesifik ini, ATAU ada record Hadir/Izin/Sakit umum di hari yang sama
      if (isAutoAlphaMadin && jadwal.guru_id) {
        const [guruAtt] = await connection.execute<RowDataPacket[]>(
          `SELECT absensi_id FROM absensi_guru 
           WHERE guru_id = ? AND tanggal = ? 
           AND (jadwal_madin_id = ? OR status IN ('Hadir', 'Izin', 'Sakit'))
           LIMIT 1`,
          [jadwal.guru_id, todayStr, jadwal.jadwal_id]
        );
        if (guruAtt.length === 0) {
          await connection.execute(
            `INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id) 
             VALUES (?, ?, "Alpha", "Otomatis - Tidak Hadir / Mengabsen", 1, ?, ?)`,
            [jadwal.guru_id, todayStr, nowTime, jadwal.jadwal_id]
          );
          totalGuruDitandai++;
          guruMarked = true;
        }
      }

      // 1.2 Cek apakah sudah ada absensi santri untuk jadwal ini hari ini
      const [existing] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM absensi WHERE jadwal_madin_id = ? AND tanggal = ?',
        [jadwal.jadwal_id, todayStr]
      );
      if ((existing[0] as any).cnt > 0) {
        if (guruMarked) {
          hasil.push({ tipe: 'Madin', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.mata_pelajaran} (${jadwal.nama_kelas})`, jumlah_ditandai: 0, guru_alpha: true });
        }
        continue;
      }

      // Ambil semua santri di kelas ini
      const [santri] = await connection.execute<RowDataPacket[]>(
        'SELECT murid_id FROM murid WHERE kelas_madin_id = ? OR kelas_madin_2_id = ?',
        [jadwal.kelas_madin_id, jadwal.kelas_madin_id]
      );
      if (santri.length === 0) {
        if (guruMarked) {
          hasil.push({ tipe: 'Madin', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.mata_pelajaran} (${jadwal.nama_kelas})`, jumlah_ditandai: 0, guru_alpha: true });
        }
        continue;
      }

      // Insert Alpha untuk semua santri
      for (const s of santri) {
        await connection.execute(
          'INSERT IGNORE INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, "Alpha", "Otomatis - Tidak Hadir")',
          [jadwal.jadwal_id, s.murid_id, todayStr]
        );
      }
      hasil.push({ tipe: 'Madin', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.mata_pelajaran} (${jadwal.nama_kelas})`, jumlah_ditandai: santri.length, guru_alpha: guruMarked });
      totalDitandai += santri.length;
    }

    // ===== 2. JADWAL QURAN =====
    const [quranJadwal] = await connection.execute<RowDataPacket[]>(
      `SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.kelas_quran_id, kq.nama_kelas, j.guru_id
       FROM jadwal_quran j
       JOIN kelas_quran kq ON j.kelas_quran_id = kq.id
       WHERE j.hari = ?`,
      [hariDB]
    );
    for (const jadwal of quranJadwal) {
      const selesaiSecs = parseTimeToSec(jadwal.jam_selesai);
      const lateSecs = selesaiSecs + tenggangSecs;
      if (nowSecs <= lateSecs) continue;

      let guruMarked = false;
      // 2.1 Catat Alpha untuk Guru jika belum ada presensi apapun hari ini (Hadir/Izin/Sakit)
      if (isAutoAlphaQuran && jadwal.guru_id) {
        const [guruAtt] = await connection.execute<RowDataPacket[]>(
          `SELECT absensi_id FROM absensi_guru 
           WHERE guru_id = ? AND tanggal = ? 
           AND (jadwal_quran_id = ? OR status IN ('Hadir', 'Izin', 'Sakit'))
           LIMIT 1`,
          [jadwal.guru_id, todayStr, jadwal.jadwal_id]
        );
        if (guruAtt.length === 0) {
          await connection.execute(
            `INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id) 
             VALUES (?, ?, "Alpha", "Otomatis - Tidak Hadir / Mengabsen", 1, ?, ?)`,
            [jadwal.guru_id, todayStr, nowTime, jadwal.jadwal_id]
          );
          totalGuruDitandai++;
          guruMarked = true;
        }
      }

      const [existing] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM absensi_quran WHERE jadwal_quran_id = ? AND tanggal = ?',
        [jadwal.jadwal_id, todayStr]
      );
      if ((existing[0] as any).cnt > 0) {
        if (guruMarked) {
          hasil.push({ tipe: 'Quran', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.mata_pelajaran} (${jadwal.nama_kelas})`, jumlah_ditandai: 0, guru_alpha: true });
        }
        continue;
      }

      const [santri] = await connection.execute<RowDataPacket[]>(
        'SELECT murid_id FROM murid WHERE kelas_quran_id = ?',
        [jadwal.kelas_quran_id]
      );
      if (santri.length === 0) {
        if (guruMarked) {
          hasil.push({ tipe: 'Quran', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.mata_pelajaran} (${jadwal.nama_kelas})`, jumlah_ditandai: 0, guru_alpha: true });
        }
        continue;
      }

      for (const s of santri) {
        await connection.execute(
          'INSERT IGNORE INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, "Alpha", "Otomatis - Tidak Hadir")',
          [jadwal.jadwal_id, s.murid_id, todayStr]
        );
      }
      hasil.push({ tipe: 'Quran', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.mata_pelajaran} (${jadwal.nama_kelas})`, jumlah_ditandai: santri.length, guru_alpha: guruMarked });
      totalDitandai += santri.length;
    }

    // ===== 3. JADWAL KEGIATAN =====
    const [kegiatanJadwal] = await connection.execute<RowDataPacket[]>(
      `SELECT j.kegiatan_id as jadwal_id, j.jam_mulai, j.jam_selesai, j.nama_kegiatan, j.kamar_id, k.nama_kamar, j.guru_id
       FROM jadwal_kegiatan j
       JOIN kamar k ON j.kamar_id = k.kamar_id
       WHERE j.hari = ?`,
      [hariDB]
    );
    for (const jadwal of kegiatanJadwal) {
      const selesaiSecs = parseTimeToSec(jadwal.jam_selesai);
      const lateSecs = selesaiSecs + tenggangSecs;
      if (nowSecs <= lateSecs) continue;

      let guruMarked = false;
      // 3.1 Catat Alpha untuk Guru/Pembina jika belum ada presensi apapun hari ini (Hadir/Izin/Sakit)
      if (isAutoAlphaKegiatan && jadwal.guru_id) {
        const [guruAtt] = await connection.execute<RowDataPacket[]>(
          `SELECT absensi_id FROM absensi_guru 
           WHERE guru_id = ? AND tanggal = ? 
           AND (kegiatan_id = ? OR status IN ('Hadir', 'Izin', 'Sakit'))
           LIMIT 1`,
          [jadwal.guru_id, todayStr, jadwal.jadwal_id]
        );
        if (guruAtt.length === 0) {
          await connection.execute(
            `INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id) 
             VALUES (?, ?, "Alpha", "Otomatis - Tidak Hadir / Mengabsen", 1, ?, ?)`,
            [jadwal.guru_id, todayStr, nowTime, jadwal.jadwal_id]
          );
          totalGuruDitandai++;
          guruMarked = true;
        }
      }

      const [existing] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM absensi_kegiatan WHERE kegiatan_id = ? AND tanggal = ?',
        [jadwal.jadwal_id, todayStr]
      );
      if ((existing[0] as any).cnt > 0) {
        if (guruMarked) {
          hasil.push({ tipe: 'Kegiatan', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.nama_kegiatan} (${jadwal.nama_kamar})`, jumlah_ditandai: 0, guru_alpha: true });
        }
        continue;
      }

      const [santri] = await connection.execute<RowDataPacket[]>(
        'SELECT murid_id FROM murid WHERE kamar_id = ?',
        [jadwal.kamar_id]
      );
      if (santri.length === 0) {
        if (guruMarked) {
          hasil.push({ tipe: 'Kegiatan', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.nama_kegiatan} (${jadwal.nama_kamar})`, jumlah_ditandai: 0, guru_alpha: true });
        }
        continue;
      }

      for (const s of santri) {
        await connection.execute(
          'INSERT IGNORE INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, "Alpha", "Otomatis - Tidak Hadir")',
          [jadwal.jadwal_id, s.murid_id, todayStr]
        );
      }
      hasil.push({ tipe: 'Kegiatan', jadwal_id: jadwal.jadwal_id, nama: `${jadwal.nama_kegiatan} (${jadwal.nama_kamar})`, jumlah_ditandai: santri.length, guru_alpha: guruMarked });
      totalDitandai += santri.length;
    }

    await connection.commit();

    if (hasil.length === 0 && totalGuruDitandai === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada jadwal yang perlu ditandai Alpha. Semua jadwal yang sudah lewat sudah memiliki data absensi (santri & guru), atau belum ada jadwal yang melewati waktu toleransi.',
        data: [],
        total: 0,
        total_santri: 0,
        total_guru: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menandai Alpha otomatis untuk ${totalDitandai} santri dan ${totalGuruDitandai} guru di ${hasil.length} sesi jadwal.`,
      data: hasil,
      total: totalDitandai + totalGuruDitandai,
      total_santri: totalDitandai,
      total_guru: totalGuruDitandai,
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('[auto-alpha] Error:', error);
    return NextResponse.json({ error: 'Gagal memproses auto-alpha: ' + error.message }, { status: 500 });
  } finally {
    connection.release();
  }
}
