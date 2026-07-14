import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { RowDataPacket, OkPacket } from 'mysql2';

export async function POST(request: NextRequest) {
  try {
    const { barcodeData, nama_kegiatan } = await request.json();

    if (!barcodeData) {
      return NextResponse.json({ success: false, message: 'Barcode tidak boleh kosong.' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toTimeString().slice(0, 8);

    // 1. Cari pemilik barcode di murid
    const [muridRows] = await db.query<RowDataPacket[]>(
      'SELECT m.murid_id, m.nama, m.nis, k.kamar_id FROM murid m LEFT JOIN kamar k ON m.kamar_id = k.kamar_id WHERE m.barcode_id = ?',
      [barcodeData]
    );

    if (muridRows.length > 0) {
      const murid = muridRows[0];

      // 2. Simpan Absensi Kamar (harian)
      if (murid.kamar_id) {
        // Cek apakah sudah diabsen hari ini
        const [existing] = await db.query<RowDataPacket[]>(
          'SELECT absensi_kamar_id FROM absensi_kamar WHERE murid_id = ? AND kamar_id = ? AND tanggal = ?',
          [murid.murid_id, murid.kamar_id, today]
        );

        if (existing.length === 0) {
          await db.query(
            'INSERT INTO absensi_kamar (kamar_id, murid_id, tanggal, waktu_masuk, status) VALUES (?, ?, ?, ?, ?)',
            [murid.kamar_id, murid.murid_id, today, now, 'Masuk']
          );
        } else {
          // Update waktu keluar jika sudah ada
          await db.query(
            'UPDATE absensi_kamar SET waktu_keluar = ?, status = ? WHERE murid_id = ? AND kamar_id = ? AND tanggal = ?',
            [now, 'Masuk', murid.murid_id, murid.kamar_id, today]
          );
        }
      }

      // 3. Simpan Absensi Kegiatan (jika dipilih ATAU otomatis berdasar jam)
      let kegiatanMessage = '';
      const hariIni = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date());
      const hariMap: Record<string, string> = {
        'Senin': 'Senin', 'Selasa': 'Selasa', 'Rabu': 'Rabu', 'Kamis': 'Kamis',
        'Jumat': 'Jumat', 'Sabtu': 'Sabtu', 'Minggu': 'Ahad', 'Ahad': 'Ahad'
      };
      const hariDB = hariMap[hariIni] || hariIni;

      let kegiatanRows: RowDataPacket[] = [];

      if (nama_kegiatan && nama_kegiatan !== '') {
        [kegiatanRows] = await db.query<RowDataPacket[]>(
          'SELECT kegiatan_id, nama_kegiatan FROM jadwal_kegiatan WHERE nama_kegiatan = ? AND hari = ? AND kamar_id = ?',
          [nama_kegiatan, hariDB, murid.kamar_id]
        );
      } else {
        // Auto detect
        [kegiatanRows] = await db.query<RowDataPacket[]>(
          'SELECT kegiatan_id, nama_kegiatan FROM jadwal_kegiatan WHERE hari = ? AND kamar_id = ? AND ? >= jam_mulai AND ? <= jam_selesai',
          [hariDB, murid.kamar_id, now, now]
        );
      }

      if (kegiatanRows.length > 0) {
        const kegiatan_id = kegiatanRows[0].kegiatan_id;
        const detected_nama = kegiatanRows[0].nama_kegiatan;
        
        const [existingK] = await db.query<RowDataPacket[]>(
          'SELECT absensi_kegiatan_id FROM absensi_kegiatan WHERE murid_id = ? AND kegiatan_id = ? AND tanggal = ?',
          [murid.murid_id, kegiatan_id, today]
        );

        if (existingK.length === 0) {
          await db.query(
            'INSERT INTO absensi_kegiatan (kegiatan_id, murid_id, tanggal, status) VALUES (?, ?, ?, ?)',
            [kegiatan_id, murid.murid_id, today, 'Hadir']
          );
          kegiatanMessage = `\n& kegiatan "${detected_nama}"`;
        } else {
          kegiatanMessage = `\n(kegiatan sudah tercatat)`;
        }
      } else {
        if (!nama_kegiatan || nama_kegiatan === '') {
          kegiatanMessage = '\n(Tidak ada jadwal kegiatan yang sedang aktif jam ini)';
        } else {
          kegiatanMessage = `\n(Tidak ada jadwal untuk "${nama_kegiatan}" hari ini)`;
        }
      }

      return NextResponse.json({
        success: true,
        message: `✅ ${murid.nama} (${murid.nis})\nAbsensi kamar${kegiatanMessage} berhasil dicatat!`,
      });
    }

    // 4. Cari di tabel guru
    const [guruRows] = await db.query<RowDataPacket[]>(
      'SELECT guru_id, nama FROM guru WHERE barcode_id = ?',
      [barcodeData]
    );

    if (guruRows.length > 0) {
      const guru = guruRows[0];
      return NextResponse.json({
        success: true,
        message: `✅ ${guru.nama} (Guru/Pengurus)\nTercatat hadir!`,
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
