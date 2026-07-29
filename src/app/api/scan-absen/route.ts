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

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 8);

    const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date());
    const hariMap: Record<string, string> = {
      'Senin': 'Senin', 'Selasa': 'Selasa', 'Rabu': 'Rabu', 'Kamis': 'Kamis',
      'Jumat': 'Jumat', 'Sabtu': 'Sabtu', 'Minggu': 'Ahad', 'Ahad': 'Ahad'
    };
    const hariDB = hariMap[hariIni] || hariIni;

    // Parse pilihan jadwal jika ada (misal: "madin:12", "quran:5", "kegiatan:3", atau plain string)
    let selectedType = '';
    let selectedId = '';

    if (selectedSchedule && selectedSchedule.includes(':')) {
      const parts = selectedSchedule.split(':');
      selectedType = parts[0];
      selectedId = parts[1];
    } else if (selectedSchedule) {
      selectedType = 'kegiatan_name';
      selectedId = selectedSchedule;
    }

    // 1. Cari pemilik barcode di tabel murid
    const [muridRows] = await db.query<RowDataPacket[]>(
      'SELECT m.murid_id, m.nama, m.nis, m.kelas_madin_id, m.kelas_quran_id, m.kamar_id, k.nama_kamar FROM murid m LEFT JOIN kamar k ON m.kamar_id = k.kamar_id WHERE m.barcode_id = ? OR m.nis = ?',
      [barcodeData, barcodeData]
    );

    if (muridRows.length > 0) {
      const murid = muridRows[0];
      const recordedMessages: string[] = [];

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
        recordedMessages.push(`Absensi Kamar (${murid.nama_kamar || 'Asrama'})`);
      }

      // B. Catat Jadwal Spesifik atau Auto-Detect
      if (selectedType === 'madin') {
        // Catat Absensi Madin
        const [existing] = await db.query<RowDataPacket[]>(
          'SELECT id FROM absensi WHERE murid_id = ? AND jadwal_madin_id = ? AND tanggal = ?',
          [murid.murid_id, selectedId, today]
        );
        if (existing.length === 0) {
          await db.query(
            'INSERT INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
            [selectedId, murid.murid_id, today, 'Hadir', 'Scan Kartu']
          );
        }
        recordedMessages.push(`Jadwal Madin`);
      } else if (selectedType === 'quran') {
        // Catat Absensi Qur'an
        const [existing] = await db.query<RowDataPacket[]>(
          'SELECT id FROM absensi_quran WHERE murid_id = ? AND jadwal_quran_id = ? AND tanggal = ?',
          [murid.murid_id, selectedId, today]
        );
        if (existing.length === 0) {
          await db.query(
            'INSERT INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)',
            [selectedId, murid.murid_id, today, 'Hadir', 'Scan Kartu']
          );
        }
        recordedMessages.push(`Jadwal Qur'an`);
      } else if (selectedType === 'kegiatan') {
        // Catat Absensi Kegiatan
        const [existing] = await db.query<RowDataPacket[]>(
          'SELECT absensi_kegiatan_id FROM absensi_kegiatan WHERE murid_id = ? AND kegiatan_id = ? AND tanggal = ?',
          [murid.murid_id, selectedId, today]
        );
        if (existing.length === 0) {
          await db.query(
            'INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status) VALUES (?, ?, ?, ?)',
            [selectedId, murid.murid_id, today, 'Hadir']
          );
        }
        recordedMessages.push(`Kegiatan Asrama`);
      } else if (selectedType === 'kegiatan_name') {
        // Cari kegiatan berdasarkan nama
        const [kegiatanRows] = await db.query<RowDataPacket[]>(
          'SELECT kegiatan_id FROM jadwal_kegiatan WHERE nama_kegiatan = ? AND (kamar_id = ? OR kamar_id IS NULL) LIMIT 1',
          [selectedId, murid.kamar_id]
        );
        if (kegiatanRows.length > 0) {
          const kId = kegiatanRows[0].kegiatan_id;
          const [existing] = await db.query<RowDataPacket[]>(
            'SELECT absensi_kegiatan_id FROM absensi_kegiatan WHERE murid_id = ? AND kegiatan_id = ? AND tanggal = ?',
            [murid.murid_id, kId, today]
          );
          if (existing.length === 0) {
            await db.query(
              'INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status) VALUES (?, ?, ?, ?)',
              [kId, murid.murid_id, today, 'Hadir']
            );
          }
          recordedMessages.push(`Kegiatan: "${selectedId}"`);
        }
      } else {
        // MODE OTOMATIS: Auto-detect jadwal aktif berdasarkan jam & hari sekarang
        // 1. Cek Kegiatan Asrama aktif
        const [activeKegiatan] = await db.query<RowDataPacket[]>(
          'SELECT kegiatan_id, nama_kegiatan FROM jadwal_kegiatan WHERE hari = ? AND (kamar_id = ? OR kamar_id IS NULL) AND ? >= jam_mulai AND ? <= jam_selesai',
          [hariDB, murid.kamar_id, now, now]
        );
        for (const k of activeKegiatan) {
          const [ext] = await db.query<RowDataPacket[]>('SELECT absensi_kegiatan_id FROM absensi_kegiatan WHERE murid_id = ? AND kegiatan_id = ? AND tanggal = ?', [murid.murid_id, k.kegiatan_id, today]);
          if (ext.length === 0) {
            await db.query('INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status) VALUES (?, ?, ?, ?)', [k.kegiatan_id, murid.murid_id, today, 'Hadir']);
          }
          recordedMessages.push(`Kegiatan: ${k.nama_kegiatan}`);
        }

        // 2. Cek Jadwal Madin aktif jika santri punya kelas_madin_id
        if (murid.kelas_madin_id) {
          const [activeMadin] = await db.query<RowDataPacket[]>(
            'SELECT j.jadwal_id, j.mata_pelajaran FROM jadwal_madin j WHERE j.kelas_madin_id = ? AND j.hari = ? AND ? >= j.jam_mulai AND ? <= j.jam_selesai',
            [murid.kelas_madin_id, hariDB, now, now]
          );
          for (const m of activeMadin) {
            const [ext] = await db.query<RowDataPacket[]>('SELECT id FROM absensi WHERE murid_id = ? AND jadwal_madin_id = ? AND tanggal = ?', [murid.murid_id, m.jadwal_id, today]);
            if (ext.length === 0) {
              await db.query('INSERT INTO absensi (jadwal_madin_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)', [m.jadwal_id, murid.murid_id, today, 'Hadir', 'Scan Kartu']);
            }
            recordedMessages.push(`Madin: ${m.mata_pelajaran}`);
          }
        }

        // 3. Cek Jadwal Quran aktif jika santri punya kelas_quran_id
        if (murid.kelas_quran_id) {
          const [activeQuran] = await db.query<RowDataPacket[]>(
            'SELECT j.id as jadwal_id, j.mata_pelajaran FROM jadwal_quran j WHERE j.kelas_quran_id = ? AND j.hari = ? AND ? >= j.jam_mulai AND ? <= j.jam_selesai',
            [murid.kelas_quran_id, hariDB, now, now]
          );
          for (const q of activeQuran) {
            const [ext] = await db.query<RowDataPacket[]>('SELECT id FROM absensi_quran WHERE murid_id = ? AND jadwal_quran_id = ? AND tanggal = ?', [murid.murid_id, q.jadwal_id, today]);
            if (ext.length === 0) {
              await db.query('INSERT INTO absensi_quran (jadwal_quran_id, murid_id, tanggal, status, keterangan) VALUES (?, ?, ?, ?, ?)', [q.jadwal_id, murid.murid_id, today, 'Hadir', 'Scan Kartu']);
            }
            recordedMessages.push(`Qur'an: ${q.mata_pelajaran}`);
          }
        }
      }

      const msgDetail = recordedMessages.length > 0 ? recordedMessages.join(', ') : 'Absensi Harian';

      return NextResponse.json({
        success: true,
        message: `✅ ${murid.nama} (${murid.nis})\n${msgDetail} berhasil dicatat!`,
      });
    }

    // 2. Cari pemilik barcode di tabel guru
    const [guruRows] = await db.query<RowDataPacket[]>(
      'SELECT guru_id, nama FROM guru WHERE barcode_id = ? OR guru_id = ?',
      [barcodeData, barcodeData]
    );

    if (guruRows.length > 0) {
      const guru = guruRows[0];

      // Catat absensi_guru
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
      message: 'Kartu tidak terdaftar di sistem. Silakan lakukan pairing terlebih dahulu.',
    }, { status: 404 });

  } catch (error: any) {
    console.error('API scan-absen Error:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan server: ' + error.message }, { status: 500 });
  }
}
