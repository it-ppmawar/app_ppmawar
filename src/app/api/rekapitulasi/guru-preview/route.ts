import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

const NAMA_BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token rekapitulasi tidak ditemukan' }, { status: 400 });
    }

    const payload = verifyToken(token) as any;
    if (!payload || !payload.guru_id) {
      return NextResponse.json({ error: 'Tautan rekapitulasi telah kedaluwarsa atau tidak valid' }, { status: 401 });
    }

    const guruId = Number(payload.guru_id);
    const bulan = Number(payload.bulan || new Date().getMonth() + 1);
    const tahun = Number(payload.tahun || new Date().getFullYear());
    const activeCategories: string[] = Array.isArray(payload.categories) && payload.categories.length > 0
      ? payload.categories
      : ['madin'];

    // 1. Ambil data guru
    const [guruRows] = await pool.execute<RowDataPacket[]>(
      `SELECT guru_id, nama, nip, no_hp, foto, alamat FROM guru WHERE guru_id = ? LIMIT 1`,
      [guruId]
    );

    if (guruRows.length === 0) {
      return NextResponse.json({ error: 'Data guru tidak ditemukan' }, { status: 404 });
    }

    const guru = guruRows[0];

    // 2. Ambil ringkasan kehadiran mengajar guru di bulan & tahun ini
    const [absensiGuruRows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END) as hadir,
        SUM(CASE WHEN status = 'Izin' THEN 1 ELSE 0 END) as izin,
        SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
        SUM(CASE WHEN status = 'Alpha' THEN 1 ELSE 0 END) as alpha,
        COUNT(*) as total_sesi
       FROM absensi_guru 
       WHERE guru_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?`,
      [guruId, bulan, tahun]
    );

    const guruAttendance = absensiGuruRows[0] || { hadir: 0, izin: 0, sakit: 0, alpha: 0, total_sesi: 0 };

    // 3. Ambil daftar kelas & jadwal yang diampu oleh guru ini berdasarkan kategori terpilih
    const classesList: any[] = [];

    // --- Kategori Madin ---
    if (activeCategories.includes('madin')) {
      const [madinJadwal] = await pool.execute<RowDataPacket[]>(
        `SELECT j.jadwal_id, j.kelas_madin_id as kelas_id, km.nama_kelas, j.mata_pelajaran, j.hari, j.jam_mulai, j.jam_selesai
         FROM jadwal_madin j
         JOIN kelas_madin km ON j.kelas_madin_id = km.kelas_id
         WHERE j.guru_id = ?
         ORDER BY km.nama_kelas ASC, j.hari ASC, j.jam_mulai ASC`,
        [guruId]
      );

      // Kelompokkan per kelas_id & mata_pelajaran
      const madinMap = new Map<string, any>();
      for (const row of madinJadwal) {
        const key = `madin_${row.kelas_id}_${row.mata_pelajaran}`;
        if (!madinMap.has(key)) {
          madinMap.set(key, {
            tipe: 'madin',
            tipe_label: 'Madrasah Diniyah',
            kelas_id: row.kelas_id,
            kelas_nama: row.nama_kelas,
            mata_pelajaran: row.mata_pelajaran,
            jadwal_info: [`${row.hari} (${row.jam_mulai?.slice(0, 5)} - ${row.jam_selesai?.slice(0, 5)})`],
            students: [],
          });
        } else {
          madinMap.get(key).jadwal_info.push(`${row.hari} (${row.jam_mulai?.slice(0, 5)} - ${row.jam_selesai?.slice(0, 5)})`);
        }
      }

      // Ambil data santri untuk tiap kelas madin
      for (const item of Array.from(madinMap.values())) {
        const [students] = await pool.execute<RowDataPacket[]>(
          `SELECT m.murid_id as id, m.nis, m.nama, m.foto, m.jenis_kelamin,
            COUNT(DISTINCT CASE WHEN att.status = 'Hadir' THEN att.tanggal END) as hadir,
            SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
            SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
            SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
           FROM murid m
           LEFT JOIN (
             SELECT murid_id, tanggal, status FROM absensi 
             WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
           ) att ON m.murid_id = att.murid_id
           LEFT JOIN absensi a ON m.murid_id = a.murid_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
           WHERE m.kelas_madin_id = ?
           GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.jenis_kelamin
           ORDER BY m.nama ASC`,
          [bulan, tahun, bulan, tahun, item.kelas_id]
        );
        item.students = students;
        classesList.push(item);
      }
    }

    // --- Kategori Qur'an ---
    if (activeCategories.includes('quran')) {
      const [quranJadwal] = await pool.execute<RowDataPacket[]>(
        `SELECT j.id as jadwal_id, j.kelas_quran_id as kelas_id, kq.nama_kelas, j.mata_pelajaran, j.hari, j.jam_mulai, j.jam_selesai
         FROM jadwal_quran j
         JOIN kelas_quran kq ON j.kelas_quran_id = kq.id
         WHERE j.guru_id = ?
         ORDER BY kq.nama_kelas ASC, j.hari ASC, j.jam_mulai ASC`,
        [guruId]
      );

      const quranMap = new Map<string, any>();
      for (const row of quranJadwal) {
        const key = `quran_${row.kelas_id}_${row.mata_pelajaran}`;
        if (!quranMap.has(key)) {
          quranMap.set(key, {
            tipe: 'quran',
            tipe_label: "Kelas Qur'an",
            kelas_id: row.kelas_id,
            kelas_nama: row.nama_kelas,
            mata_pelajaran: row.mata_pelajaran || 'Tahfidz / Tilawah',
            jadwal_info: [`${row.hari} (${row.jam_mulai?.slice(0, 5)} - ${row.jam_selesai?.slice(0, 5)})`],
            students: [],
          });
        } else {
          quranMap.get(key).jadwal_info.push(`${row.hari} (${row.jam_mulai?.slice(0, 5)} - ${row.jam_selesai?.slice(0, 5)})`);
        }
      }

      for (const item of Array.from(quranMap.values())) {
        const [students] = await pool.execute<RowDataPacket[]>(
          `SELECT m.murid_id as id, m.nis, m.nama, m.foto, m.jenis_kelamin,
            COUNT(DISTINCT CASE WHEN att.status = 'Hadir' THEN att.tanggal END) as hadir,
            SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
            SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
            SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
           FROM murid m
           LEFT JOIN (
             SELECT murid_id, tanggal, status FROM absensi_quran 
             WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
           ) att ON m.murid_id = att.murid_id
           LEFT JOIN absensi_quran a ON m.murid_id = a.murid_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
           WHERE m.kelas_quran_id = ?
           GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.jenis_kelamin
           ORDER BY m.nama ASC`,
          [bulan, tahun, bulan, tahun, item.kelas_id]
        );
        item.students = students;
        classesList.push(item);
      }
    }

    // --- Kategori Kamar / Asrama ---
    if (activeCategories.includes('kamar')) {
      const [kamarJadwal] = await pool.execute<RowDataPacket[]>(
        `SELECT jk.kegiatan_id as jadwal_id, jk.kamar_id as kelas_id, k.nama_kamar as nama_kelas, jk.nama_kegiatan as mata_pelajaran, jk.hari, jk.jam_mulai, jk.jam_selesai
         FROM jadwal_kegiatan jk
         JOIN kamar k ON jk.kamar_id = k.kamar_id
         WHERE jk.guru_id = ?
         ORDER BY k.nama_kamar ASC, jk.hari ASC, jk.jam_mulai ASC`,
        [guruId]
      );

      const kamarMap = new Map<string, any>();
      for (const row of kamarJadwal) {
        const key = `kamar_${row.kelas_id}_${row.mata_pelajaran}`;
        if (!kamarMap.has(key)) {
          kamarMap.set(key, {
            tipe: 'kamar',
            tipe_label: 'Asrama / Kamar',
            kelas_id: row.kelas_id,
            kelas_nama: row.nama_kelas,
            mata_pelajaran: row.mata_pelajaran || 'Kegiatan Asrama',
            jadwal_info: [`${row.hari} (${row.jam_mulai?.slice(0, 5)} - ${row.jam_selesai?.slice(0, 5)})`],
            students: [],
          });
        } else {
          kamarMap.get(key).jadwal_info.push(`${row.hari} (${row.jam_mulai?.slice(0, 5)} - ${row.jam_selesai?.slice(0, 5)})`);
        }
      }

      for (const item of Array.from(kamarMap.values())) {
        const [students] = await pool.execute<RowDataPacket[]>(
          `SELECT m.murid_id as id, m.nis, m.nama, m.foto, m.jenis_kelamin,
            COUNT(DISTINCT CASE WHEN att.status = 'Hadir' THEN att.tanggal END) as hadir,
            SUM(CASE WHEN a.status = 'Izin' THEN 1 ELSE 0 END) as izin,
            SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END) as sakit,
            SUM(CASE WHEN a.status = 'Alpha' THEN 1 ELSE 0 END) as alpha
           FROM murid m
           LEFT JOIN (
             SELECT murid_id, tanggal, status FROM absensi_kegiatan 
             WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
           ) att ON m.murid_id = att.murid_id
           LEFT JOIN absensi_kegiatan a ON m.murid_id = a.murid_id AND MONTH(a.tanggal) = ? AND YEAR(a.tanggal) = ?
           WHERE m.kamar_id = ?
           GROUP BY m.murid_id, m.nis, m.nama, m.foto, m.jenis_kelamin
           ORDER BY m.nama ASC`,
          [bulan, tahun, bulan, tahun, item.kelas_id]
        );
        item.students = students;
        classesList.push(item);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        guru: {
          guru_id: guru.guru_id,
          nama: guru.nama,
          nip: guru.nip,
          no_hp: guru.no_hp,
          foto: guru.foto,
          kehadiran: guruAttendance,
        },
        periode: {
          bulan,
          tahun,
          bulan_nama: NAMA_BULAN[bulan] || `Bulan ${bulan}`,
        },
        classes: classesList,
        categories: activeCategories,
      },
    });

  } catch (error: any) {
    console.error('[rekapitulasi/guru-preview] Error:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
