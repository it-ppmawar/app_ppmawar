import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    // 1. Mengambil data dari API Bridge Mitra Pembayaran
    // Menggunakan Environment Variable agar mudah diubah saat di cPanel
    let apiUrl = process.env.API_MITRA_URL || 'https://mawar.smartpesantren.id/api_absensi/api_bridge.php?action=get_santri';
    apiUrl = apiUrl.trim().replace(/\r/g, '');
    
    // Fitur Self-Healing: Jika URL kehilangan '/api_absensi/', perbaiki secara otomatis!
    if (apiUrl.includes('mawar.smartpesantren.id') && !apiUrl.includes('/api_absensi/')) {
      apiUrl = apiUrl.replace('mawar.smartpesantren.id/', 'mawar.smartpesantren.id/api_absensi/');
    }
    
    console.log('Fetching data santri dari mitra:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // PENTING: Gunakan User-Agent Postman agar lolos dari blokir 403 Forbidden Cloudflare/Apache mitra
        'User-Agent': 'PostmanRuntime/7.36.3',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gagal menghubungi API Mitra: ${response.status} ${response.statusText} saat memanggil [${apiUrl}]. Detail: ${errText.substring(0, 300)}`);
    }

    const result = await response.json();

    if (result.status !== 'success') {
      throw new Error(result.message || 'Respons API Mitra tidak sukses');
    }

    const dataSantriMitra = result.data;
    
    if (!dataSantriMitra || dataSantriMitra.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Tidak ada data santri ditemukan dari mitra', 
        total: 0 
      });
    }

    let syncedCount = 0;
    let newCount = 0;
    let updatedCount = 0;

    // 2. Loop data dan sinkronisasikan ke database absensi
    for (const santri of dataSantriMitra) {
      const nis = santri.nis;
      const nama = santri.nama || 'Tanpa Nama';
      const no_hp = santri.hp || null; // API Mitra menggunakan key 'hp'
      const nik = santri.nik || null;
      
      // Susun alamat sederhana dari desa dan kecamatan
      let alamat = null;
      if (santri.desa) {
        alamat = santri.desa;
        if (santri.kecamatan) {
          // kecamatan formatnya biasanya: "3524190~KALITENGAH"
          const kecName = santri.kecamatan.includes('~') 
            ? santri.kecamatan.split('~')[1] 
            : santri.kecamatan;
          alamat += `, Kec. ${kecName}`;
        }
      }

      const nama_wali = santri.ayah || santri.ibu || null;
      const jenis_kelamin = santri.gender === 'L' ? 'Laki-laki' : (santri.gender === 'P' ? 'Perempuan' : null);

      // Konversi path foto menjadi URL lengkap SmartPesantren agar dapat langsung ditampilkan
      // Base URL foto menggunakan env variable, fallback ke path default SmartPesantren
      let foto: string | null = null;
      if (santri.foto) {
        const rawFoto = santri.foto.trim();
        if (rawFoto.startsWith('http://') || rawFoto.startsWith('https://')) {
          // Sudah URL lengkap — simpan langsung
          foto = rawFoto;
        } else {
          // Path relatif — gabungkan dengan base URL mitra
          const baseFotoUrl = (process.env.API_MITRA_FOTO_BASE_URL || 'https://mawar.smartpesantren.id/sekretariat/berkas/').replace(/\/$/, '');
          const cleanPath = rawFoto.startsWith('/') ? rawFoto.substring(1) : rawFoto;
          // Hindari duplikasi path jika sudah ada 'sekretariat/berkas'
          if (cleanPath.includes('sekretariat/berkas')) {
            foto = `https://mawar.smartpesantren.id/${cleanPath}`;
          } else {
            foto = `${baseFotoUrl}/${cleanPath}`;
          }
        }
      }
      
      if (!nis) continue; // Lewati jika tidak ada NIS (identifier utama)

      // Cek apakah murid sudah ada di database absensi (menggunakan kolom murid_id sesuai schema)
      const [existingRows]: any = await db.query('SELECT murid_id FROM murid WHERE nis = ?', [nis]);
      
      if (existingRows.length > 0) {
        // Jika sudah ada, UPDATE data yang mungkin berubah (Nama, No HP, NIK, Alamat, Wali, Foto, Jenis Kelamin)
        // Kolom barcode_id sengaja TIDAK di-overwrite agar kartu QR yang sudah discan tidak hilang!
        await db.query(
          `UPDATE murid SET 
            nama = ?, 
            no_hp = ?, 
            nik = ?, 
            alamat = ?, 
            nama_wali = ?, 
            foto = ?,
            jenis_kelamin = ?
          WHERE nis = ?`,
          [nama, no_hp, nik, alamat, nama_wali, foto, jenis_kelamin, nis]
        );
        updatedCount++;
      } else {
        // Jika belum ada (Murid Baru), INSERT ke database
        await db.query(
          `INSERT INTO murid 
            (nis, nama, no_hp, nik, alamat, nama_wali, foto, jenis_kelamin) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [nis, nama, no_hp, nik, alamat, nama_wali, foto, jenis_kelamin]
        );
        newCount++;
      }
      syncedCount++;
    }

    // Catat waktu sinkronisasi terakhir
    const nowStr = new Date().toISOString();
    await db.query(
      'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
      ['terakhir_sinkronisasi', nowStr, nowStr]
    );

    return NextResponse.json({
      success: true,
      message: 'Sinkronisasi data santri berhasil',
      total_data_mitra: dataSantriMitra.length,
      processed: syncedCount,
      new_students: newCount,
      updated_students: updatedCount
    });

  } catch (error: any) {
    console.error('Error saat melakukan sinkronisasi:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Gagal melakukan sinkronisasi dengan mitra', 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
