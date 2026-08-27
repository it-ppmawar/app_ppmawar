import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: NextRequest) {
  try {
    const { barcodeData, selectedSchedule } = await request.json();

    if (!barcodeData) {
      return NextResponse.json({ success: false, message: 'Barcode tidak boleh kosong.' }, { status: 400 });
    }

    const nowObj = new Date();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(nowObj);
    const now = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }); // HH:mm:ss WIB

    // Pembersihan String QR / Barcode
    const rawCode = String(barcodeData).trim();
    // Ekstrak hanya digit jika QR berisi URL atau prefix
    const digitsOnly = rawCode.replace(/\D/g, '');

    const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
    const hariMap: Record<string, string> = {
      'Senin': 'Senin', 'Selasa': 'Selasa', 'Rabu': 'Rabu', 'Kamis': 'Kamis',
      'Jumat': 'Jumat', 'Sabtu': 'Sabtu', 'Minggu': 'Ahad', 'Ahad': 'Ahad'
    };
    const hariDB = hariMap[hariIni] || hariIni;

    // 1. CARI PEMILIK KARTU DI TABEL MURID (SANTRI LAMA & BARU)
    // Menggunakan pencocokan fleksibel: barcode_id ATAU nis (dengan trim & digits fallback)
    let [muridRows] = await db.query<RowDataPacket[]>(
      `SELECT m.murid_id, m.nama, m.nis, m.barcode_id, m.foto, m.kelas_madin_id, m.kelas_quran_id, m.kamar_id, k.nama_kamar 
       FROM murid m 
       LEFT JOIN kamar k ON m.kamar_id = k.kamar_id 
       WHERE TRIM(m.barcode_id) = ? OR TRIM(m.nis) = ? OR TRIM(m.barcode_id) = ? OR TRIM(m.nis) = ?`,
      [rawCode, rawCode, digitsOnly, digitsOnly]
    );

    // Fallback jika belum ketemu: cari dengan LIKE jika digit minimal 5 karakter
    if (muridRows.length === 0 && digitsOnly.length >= 5) {
      [muridRows] = await db.query<RowDataPacket[]>(
        `SELECT m.murid_id, m.nama, m.nis, m.barcode_id, m.foto, m.kelas_madin_id, m.kelas_quran_id, m.kamar_id, k.nama_kamar 
         FROM murid m 
         LEFT JOIN kamar k ON m.kamar_id = k.kamar_id 
         WHERE m.nis LIKE ? OR m.barcode_id LIKE ?`,
        [`%${digitsOnly}%`, `%${digitsOnly}%`]
      );
    }

    // Ambil waktu tenggang dari pengaturan (default: 2 jam)
    const [settingRows] = await db.query<RowDataPacket[]>(
      'SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = "waktu_tenggang_absensi"'
    );
    const waktuTenggangJam = (settingRows.length > 0 && !isNaN(parseFloat(settingRows[0].nilai))) 
      ? parseFloat(settingRows[0].nilai) 
      : 2;

    const parseTimeToSec = (tStr: string) => {
      const [h, m, s] = String(tStr).split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };
    const nowSecs = parseTimeToSec(now);
    const tenggangSecs = waktuTenggangJam * 3600;

    if (muridRows.length > 0) {
      const murid = muridRows[0];
      const recordedMessages: string[] = [];

      // SELF-HEALING / AUTO-PAIRING INSTAN:
      // Jika barcode_id masih NULL/kosong, langsung update barcode_id = nis santri saat ini juga!
      if (!murid.barcode_id || murid.barcode_id.trim() === '') {
        await db.query('UPDATE murid SET barcode_id = ? WHERE murid_id = ?', [murid.nis, murid.murid_id]);
      }

      // A. Absensi Kamar (Harian)
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
        recordedMessages.push(`Absensi kamar`);
      }

      // B. KATEGORI JADWAL SESUAI 4 PILIHAN DROPDOWN
      const targetCategory = selectedSchedule || 'otomatis';

      // --- 1. KEGIATAN ASRAMA & PESANTREN ---
      if (targetCategory === 'kegiatan' || targetCategory === 'otomatis' || targetCategory === '') {
        const [allKegiatan] = await db.query<RowDataPacket[]>(
          'SELECT kegiatan_id, nama_kegiatan, jam_mulai, jam_selesai FROM jadwal_kegiatan WHERE hari = ? AND (kamar_id = ? OR kamar_id IS NULL)',
          [hariDB, murid.kamar_id]
        );

        if (allKegiatan.length > 0) {
          for (const k of allKegiatan) {
            const mulaiSecs = parseTimeToSec(k.jam_mulai);
            const selesaiSecs = parseTimeToSec(k.jam_selesai);
            const earlySecs = mulaiSecs - 30 * 60; // Buka 30 menit sebelum jam mulai
            const lateSecs = selesaiSecs + tenggangSecs; // Toleransi s/d jam_selesai + waktu_tenggang

            if (nowSecs >= earlySecs && nowSecs <= lateSecs) {
              const [ext] = await db.query<RowDataPacket[]>(
                'SELECT absensi_kegiatan_id FROM absensi_kegiatan WHERE murid_id = ? AND kegiatan_id = ? AND tanggal = ?',
                [murid.murid_id, k.kegiatan_id, today]
              );
              if (ext.length === 0) {
                await db.query(
                  'INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
                  [k.kegiatan_id, murid.murid_id, today, 'Hadir', 'Scan Kartu']
                );
              }
              recordedMessages.push(`kegiatan "${k.nama_kegiatan}"`);
            } else if (nowSecs > lateSecs) {
              const maxTimeStr = new Date(lateSecs * 1000).toISOString().substring(11, 16);
              recordedMessages.push(`⛔ (waktu absen kegiatan "${k.nama_kegiatan}" telah lewat/habis, batas toleransi ${maxTimeStr})`);
            } else if (nowSecs < earlySecs) {
              recordedMessages.push(`⏱️ (waktu absen kegiatan "${k.nama_kegiatan}" belum dibuka)`);
            }
          }
        } else if (targetCategory === 'kegiatan') {
          recordedMessages.push(`(tidak ada jadwal kegiatan terdaftar hari ini)`);
        }
      }

      // --- 2. MADRASAH DINIYAH (MADIN) ---
      if (targetCategory === 'madin' || targetCategory === 'otomatis' || targetCategory === '') {
        if (murid.kelas_madin_id) {
          const [allMadin] = await db.query<RowDataPacket[]>(
            'SELECT j.jadwal_id, j.mata_pelajaran, j.jam_mulai, j.jam_selesai FROM jadwal_madin j WHERE j.kelas_madin_id = ? AND j.hari = ?',
            [murid.kelas_madin_id, hariDB]
          );

          if (allMadin.length > 0) {
            for (const m of allMadin) {
              const mulaiSecs = parseTimeToSec(m.jam_mulai);
              const selesaiSecs = parseTimeToSec(m.jam_selesai);
              const earlySecs = mulaiSecs - 30 * 60;
              const lateSecs = selesaiSecs + tenggangSecs;

              if (nowSecs >= earlySecs && nowSecs <= lateSecs) {
                const [ext] = await db.query<RowDataPacket[]>(
                  'SELECT id FROM absensi WHERE murid_id = ? AND jadwal_madin_id = ? AND tanggal = ?',
                  [murid.murid_id, m.jadwal_id, today]
                );
                if (ext.length === 0) {
                  await db.query(
                    'INSERT INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
                    [m.jadwal_id, murid.murid_id, today, 'Hadir', 'Scan Kartu']
                  );
                }
                recordedMessages.push(`Madin (${m.mata_pelajaran})`);
              } else if (nowSecs > lateSecs) {
                recordedMessages.push(`⛔ (Madin "${m.mata_pelajaran}": waktu absen telah lewat)`);
              } else if (nowSecs < earlySecs) {
                recordedMessages.push(`⏱️ (Madin "${m.mata_pelajaran}": belum waktunya)`);
              }
            }
          } else if (targetCategory === 'madin') {
            recordedMessages.push(`(tidak ada pelajaran Madin terdaftar hari ini)`);
          }
        } else if (targetCategory === 'madin') {
          recordedMessages.push(`(belum terdaftar di kelas Madin)`);
        }
      }

      // --- 3. MADRASAH AL-QUR'AN (MQ) ---
      if (targetCategory === 'quran' || targetCategory === 'otomatis' || targetCategory === '') {
        if (murid.kelas_quran_id) {
          const [allQuran] = await db.query<RowDataPacket[]>(
            'SELECT j.id as jadwal_id, j.mata_pelajaran, j.jam_mulai, j.jam_selesai FROM jadwal_quran j WHERE j.kelas_quran_id = ? AND j.hari = ?',
            [murid.kelas_quran_id, hariDB]
          );

          if (allQuran.length > 0) {
            for (const q of allQuran) {
              const mulaiSecs = parseTimeToSec(q.jam_mulai);
              const selesaiSecs = parseTimeToSec(q.jam_selesai);
              const earlySecs = mulaiSecs - 30 * 60;
              const lateSecs = selesaiSecs + tenggangSecs;

              if (nowSecs >= earlySecs && nowSecs <= lateSecs) {
                const [ext] = await db.query<RowDataPacket[]>(
                  'SELECT id FROM absensi_quran WHERE murid_id = ? AND jadwal_quran_id = ? AND tanggal = ?',
                  [murid.murid_id, q.jadwal_id, today]
                );
                if (ext.length === 0) {
                  await db.query(
                    'INSERT INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
                    [q.jadwal_id, murid.murid_id, today, 'Hadir', 'Scan Kartu']
                  );
                }
                recordedMessages.push(`MQ (${q.mata_pelajaran})`);
              } else if (nowSecs > lateSecs) {
                recordedMessages.push(`⛔ (MQ "${q.mata_pelajaran}": waktu absen telah lewat)`);
              } else if (nowSecs < earlySecs) {
                recordedMessages.push(`⏱️ (MQ "${q.mata_pelajaran}": belum waktunya)`);
              }
            }
          } else if (targetCategory === 'quran') {
            recordedMessages.push(`(tidak ada pelajaran MQ terdaftar hari ini)`);
          }
        } else if (targetCategory === 'quran') {
          recordedMessages.push(`(belum terdaftar di kelas MQ)`);
        }
      }

      const msgDetail = recordedMessages.length > 0 ? recordedMessages.join(' ') : 'Absensi harian';

      return NextResponse.json({
        success: true,
        message: `✅ ${murid.nama} (${murid.nis})\n${msgDetail} berhasil dicatat!`,
        nama: murid.nama,
        nis: murid.nis,
        foto: murid.foto || null,
      });
    }

    // 2. CARI PEMILIK KARTU DI TABEL GURU / PENGURUS
    const [guruRows] = await db.query<RowDataPacket[]>(
      `SELECT guru_id, nama FROM guru 
       WHERE TRIM(barcode_id) = ? OR TRIM(barcode_id) = ? OR guru_id = ?`,
      [rawCode, digitsOnly, digitsOnly]
    );

    if (guruRows.length > 0) {
      const guru = guruRows[0];

      const [guruAbsen] = await db.query<RowDataPacket[]>(
        'SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ?',
        [guru.guru_id, today]
      );
      if (guruAbsen.length === 0) {
        await db.query(
          'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi) VALUES (?, ?, "Hadir", "Scan Kartu Mandiri", 1, ?)',
          [guru.guru_id, today, now]
        );
      }

      return NextResponse.json({
        success: true,
        message: `✅ ${guru.nama} (Guru/Pengurus)\nKehadiran berhasil dicatat pada ${now}!`,
      });
    }

    return NextResponse.json({
      success: false,
      message: `Kartu tidak terdaftar di sistem (Data Scan: ${rawCode}). Silakan lakukan pairing terlebih dahulu.`,
    }, { status: 404 });

  } catch (error: any) {
    console.error('API scan-absen Error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server: ' + error.message }, { status: 500 });
  }
}
