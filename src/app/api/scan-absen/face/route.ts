import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * POST /api/scan-absen/face
 * Body: { murid_id: number, selectedSchedule: string }
 *
 * Merekam absensi santri yang sudah diidentifikasi via Face AI.
 * Logika absensi identik dengan /api/scan-absen, namun lookup via murid_id
 * (bukan barcode), karena identifikasi wajah sudah terjadi di sisi klien.
 */
export async function POST(request: NextRequest) {
  try {
    const { murid_id, selectedSchedule } = await request.json();

    if (!murid_id || isNaN(Number(murid_id))) {
      return NextResponse.json({ success: false, message: 'murid_id tidak valid.' }, { status: 400 });
    }

    const nowObj = new Date();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(nowObj);
    const now = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false });

    const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(nowObj);
    const hariMap: Record<string, string> = {
      'Senin': 'Senin', 'Selasa': 'Selasa', 'Rabu': 'Rabu', 'Kamis': 'Kamis',
      'Jumat': 'Jumat', 'Sabtu': 'Sabtu', 'Minggu': 'Ahad', 'Ahad': 'Ahad'
    };
    const hariDB = hariMap[hariIni] || hariIni;

    // ── Ambil data santri dari DB ──────────────────────────────────
    const [muridRows] = await db.query<RowDataPacket[]>(
      `SELECT m.murid_id, m.nama, m.nis, m.foto, m.kelas_madin_id, m.kelas_quran_id, m.kamar_id, k.nama_kamar
       FROM murid m
       LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
       WHERE m.murid_id = ?`,
      [Number(murid_id)]
    );

    if (muridRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Santri tidak ditemukan di database.'
      }, { status: 404 });
    }

    const murid = muridRows[0];
    const recordedMessages: string[] = [];

    // ── Waktu tenggang (default 2 jam) ─────────────────────────────
    const [settingRows] = await db.query<RowDataPacket[]>(
      'SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = "waktu_tenggang_absensi"'
    );
    const waktuTenggangJam = (settingRows.length > 0 && !isNaN(parseFloat(settingRows[0].nilai)))
      ? parseFloat(settingRows[0].nilai) : 2;

    const parseTimeToSec = (tStr: string) => {
      const [h, m, s] = String(tStr).split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };
    const nowSecs = parseTimeToSec(now);
    const tenggangSecs = waktuTenggangJam * 3600;

    const targetCategory = selectedSchedule || 'otomatis';

    // ── A. Absensi Kamar (Harian) ──────────────────────────────────
    if (murid.kamar_id) {
      const [existingKamar] = await db.query<RowDataPacket[]>(
        'SELECT absensi_kamar_id FROM absensi_kamar WHERE murid_id = ? AND kamar_id = ? AND tanggal = ?',
        [murid.murid_id, murid.kamar_id, today]
      );
      if (existingKamar.length === 0) {
        await db.query(
          'INSERT INTO absensi_kamar (kamar_id, murid_id, tanggal, waktu_masuk, status) VALUES (?, ?, ?, ?, ?)',
          [murid.kamar_id, murid.murid_id, today, now, 'Masuk']
        );
      } else {
        await db.query(
          'UPDATE absensi_kamar SET waktu_keluar = ?, status = ? WHERE murid_id = ? AND kamar_id = ? AND tanggal = ?',
          [now, 'Masuk', murid.murid_id, murid.kamar_id, today]
        );
      }
      recordedMessages.push('Absensi kamar');
    }

    // ── B. Kegiatan Asrama & Pesantren ─────────────────────────────
    if (targetCategory === 'kegiatan' || targetCategory === 'otomatis' || targetCategory === '') {
      const [allKegiatan] = await db.query<RowDataPacket[]>(
        'SELECT kegiatan_id, nama_kegiatan, jam_mulai, jam_selesai FROM jadwal_kegiatan WHERE hari = ? AND (kamar_id = ? OR kamar_id IS NULL)',
        [hariDB, murid.kamar_id]
      );
      for (const k of allKegiatan) {
        const mulaiSecs = parseTimeToSec(k.jam_mulai);
        const selesaiSecs = parseTimeToSec(k.jam_selesai);
        const earlySecs = mulaiSecs - 30 * 60;
        const lateSecs = selesaiSecs + tenggangSecs;

        if (nowSecs >= earlySecs && nowSecs <= lateSecs) {
          // 1. Inisialisasi teman sekamar/kegiatan yang belum scan sebagai Alpha (Scoped Auto-Alpa)
          await db.query(
            `INSERT IGNORE INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status, keterangan)
             SELECT ?, m2.murid_id, ?, 'Alpha', 'Belum Scan'
             FROM murid m2
             WHERE (m2.kamar_id = ? OR ? IS NULL)
               AND m2.murid_id != ?
               AND NOT EXISTS (
                 SELECT 1 FROM absensi_kegiatan a2 
                 WHERE a2.kegiatan_id = ? AND a2.murid_id = m2.murid_id AND a2.tanggal = ?
               )`,
            [k.kegiatan_id, today, murid.kamar_id, murid.kamar_id, murid.murid_id, k.kegiatan_id, today]
          );

          // 2. Tandai santri yang melakukan scan sebagai Hadir
          const [ext] = await db.query<RowDataPacket[]>(
            'SELECT absensi_kegiatan_id FROM absensi_kegiatan WHERE murid_id = ? AND kegiatan_id = ? AND tanggal = ?',
            [murid.murid_id, k.kegiatan_id, today]
          );
          if (ext.length === 0) {
            await db.query(
              'INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
              [k.kegiatan_id, murid.murid_id, today, 'Hadir', 'Face AI']
            );
          } else {
            await db.query(
              'UPDATE absensi_kegiatan SET status = ?, keterangan = ? WHERE murid_id = ? AND kegiatan_id = ? AND tanggal = ?',
              ['Hadir', 'Face AI', murid.murid_id, k.kegiatan_id, today]
            );
          }
          recordedMessages.push(`Kegiatan "${k.nama_kegiatan}"`);
        }
      }
    }

    // ── C. Madrasah Diniyah (Madin) ────────────────────────────────
    if (targetCategory === 'madin' || targetCategory === 'otomatis' || targetCategory === '') {
      if (murid.kelas_madin_id) {
        const [allMadin] = await db.query<RowDataPacket[]>(
          'SELECT j.jadwal_id, j.mata_pelajaran, j.jam_mulai, j.jam_selesai FROM jadwal_madin j WHERE j.kelas_madin_id = ? AND j.hari = ?',
          [murid.kelas_madin_id, hariDB]
        );
        for (const m of allMadin) {
          const mulaiSecs = parseTimeToSec(m.jam_mulai);
          const selesaiSecs = parseTimeToSec(m.jam_selesai);
          const earlySecs = mulaiSecs - 30 * 60;
          const lateSecs = selesaiSecs + tenggangSecs;

          if (nowSecs >= earlySecs && nowSecs <= lateSecs) {
            // 1. Inisialisasi santri sekelas Madin yang belum scan sebagai Alpha (Scoped Auto-Alpa)
            await db.query(
              `INSERT IGNORE INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan)
               SELECT ?, m2.murid_id, ?, 'Alpha', 'Belum Scan'
               FROM murid m2
               WHERE (m2.kelas_madin_id = ? OR m2.kelas_madin_2_id = ?)
                 AND m2.murid_id != ?
                 AND NOT EXISTS (
                   SELECT 1 FROM absensi a2 
                   WHERE a2.jadwal_madin_id = ? AND a2.murid_id = m2.murid_id AND a2.tanggal = ?
                 )`,
              [m.jadwal_id, today, murid.kelas_madin_id, murid.kelas_madin_id, murid.murid_id, m.jadwal_id, today]
            );

            // 2. Tandai santri yang melakukan scan sebagai Hadir
            const [ext] = await db.query<RowDataPacket[]>(
              'SELECT absensi_id FROM absensi WHERE murid_id = ? AND jadwal_madin_id = ? AND tanggal = ?',
              [murid.murid_id, m.jadwal_id, today]
            );
            if (ext.length === 0) {
              await db.query(
                'INSERT INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
                [m.jadwal_id, murid.murid_id, today, 'Hadir', 'Face AI']
              );
            } else {
              await db.query(
                'UPDATE absensi SET status = ?, keterangan = ? WHERE murid_id = ? AND jadwal_madin_id = ? AND tanggal = ?',
                ['Hadir', 'Face AI', murid.murid_id, m.jadwal_id, today]
              );
            }
            recordedMessages.push(`Madin (${m.mata_pelajaran})`);
          }
        }
      }
    }

    // ── D. Madrasah Al-Qur'an (MQ) ────────────────────────────────
    if (targetCategory === 'quran' || targetCategory === 'otomatis' || targetCategory === '') {
      if (murid.kelas_quran_id) {
        const [allQuran] = await db.query<RowDataPacket[]>(
          'SELECT j.id as jadwal_id, j.mata_pelajaran, j.jam_mulai, j.jam_selesai FROM jadwal_quran j WHERE j.kelas_quran_id = ? AND j.hari = ?',
          [murid.kelas_quran_id, hariDB]
        );
        for (const q of allQuran) {
          const mulaiSecs = parseTimeToSec(q.jam_mulai);
          const selesaiSecs = parseTimeToSec(q.jam_selesai);
          const earlySecs = mulaiSecs - 30 * 60;
          const lateSecs = selesaiSecs + tenggangSecs;

          if (nowSecs >= earlySecs && nowSecs <= lateSecs) {
            // 1. Inisialisasi santri sekelas Quran yang belum scan sebagai Alpha (Scoped Auto-Alpa)
            await db.query(
              `INSERT IGNORE INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan)
               SELECT ?, m2.murid_id, ?, 'Alpha', 'Belum Scan'
               FROM murid m2
               WHERE m2.kelas_quran_id = ?
                 AND m2.murid_id != ?
                 AND NOT EXISTS (
                   SELECT 1 FROM absensi_quran a2 
                   WHERE a2.jadwal_quran_id = ? AND a2.murid_id = m2.murid_id AND a2.tanggal = ?
                 )`,
              [q.jadwal_id, today, murid.kelas_quran_id, murid.murid_id, q.jadwal_id, today]
            );

            // 2. Tandai santri yang melakukan scan sebagai Hadir
            const [ext] = await db.query<RowDataPacket[]>(
              'SELECT absensi_quran_id FROM absensi_quran WHERE murid_id = ? AND jadwal_quran_id = ? AND tanggal = ?',
              [murid.murid_id, q.jadwal_id, today]
            );
            if (ext.length === 0) {
              await db.query(
                'INSERT INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
                [q.jadwal_id, murid.murid_id, today, 'Hadir', 'Face AI']
              );
            } else {
              await db.query(
                'UPDATE absensi_quran SET status = ?, keterangan = ? WHERE murid_id = ? AND jadwal_quran_id = ? AND tanggal = ?',
                ['Hadir', 'Face AI', murid.murid_id, q.jadwal_id, today]
              );
            }
            recordedMessages.push(`MQ (${q.mata_pelajaran})`);
          }
        }
      }
    }

    const msgDetail = recordedMessages.length > 0
      ? recordedMessages.join(', ')
      : 'Absensi harian tercatat';

    return NextResponse.json({
      success: true,
      message: `✅ ${murid.nama} (${murid.nis})\n${msgDetail} berhasil dicatat via Face AI pada ${now}!`,
      nama: murid.nama,
      nis: murid.nis,
      foto: murid.foto || null,
    });

  } catch (error: any) {
    console.error('API scan-absen/face Error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server: ' + error.message },
      { status: 500 }
    );
  }
}
