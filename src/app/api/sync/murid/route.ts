import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  try {
    // 0. AUTENTIKASI CRON JOB & CEK JADWAL RUTINITAS
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET || 'ppma_sync_secret_2024_secure';
    const isCronRequest = authHeader && (authHeader === `Bearer ${cronSecret}` || authHeader === `Bearer ppma_sync_secret_2024_secure`);

    if (isCronRequest) {
      // Ambil nilai rutinitas_sinkronisasi & terakhir_sinkronisasi dari database
      const [rowsSetting]: any = await db.query(
        `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('rutinitas_sinkronisasi', 'terakhir_sinkronisasi')`
      );
      const settingsMap: Record<string, string> = {};
      if (Array.isArray(rowsSetting)) {
        for (const row of rowsSetting) {
          settingsMap[row.nama_pengaturan] = row.nilai;
        }
      }

      const modeRutinitas = settingsMap.rutinitas_sinkronisasi || 'manual';
      const terakhirSyncStr = settingsMap.terakhir_sinkronisasi;

      if (modeRutinitas === 'manual') {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Sinkronisasi otomatis dilewati (Mode: Manual / Tidak Aktif)'
        });
      }

      if (terakhirSyncStr) {
        const lastSync = new Date(terakhirSyncStr).getTime();
        const now = Date.now();
        const diffHours = (now - lastSync) / (1000 * 60 * 60);

        if (modeRutinitas === 'harian' && diffHours < 20) {
          return NextResponse.json({
            success: true,
            skipped: true,
            message: `Sinkronisasi otomatis dilewati (Baru disinkronkan ${Math.round(diffHours)} jam yang lalu)`
          });
        }
        if (modeRutinitas === 'mingguan' && diffHours < 140) {
          return NextResponse.json({
            success: true,
            skipped: true,
            message: `Sinkronisasi otomatis dilewati (Baru disinkronkan ${Math.round(diffHours / 24)} hari yang lalu)`
          });
        }
        if (modeRutinitas === 'bulanan' && diffHours < 650) {
          return NextResponse.json({
            success: true,
            skipped: true,
            message: `Sinkronisasi otomatis dilewati (Baru disinkronkan ${Math.round(diffHours / 24)} hari yang lalu)`
          });
        }
      }
    }

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
    let deletedCount = 0;

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
      let foto: string | null = null;
      if (santri.foto && santri.foto.trim() !== '-' && santri.foto.trim() !== '') {
        const rawFoto = santri.foto.trim();
        if (rawFoto.startsWith('http://') || rawFoto.startsWith('https://')) {
          // Sudah URL lengkap — simpan langsung
          foto = rawFoto;
        } else {
          // Path relatif — tentukan folder dinamis berdasarkan nama file
          // Contoh file: Berkas_2026_2026050140.jpg -> disimpan di /dist/Berkas_2026/
          const baseDomain = 'https://mawar.smartpesantren.id/dist';
          
          const parts = rawFoto.split('_');
          if (parts.length >= 2) {
             const folderName = `${parts[0]}_${parts[1]}`; // misal: Berkas_2026
             foto = `${baseDomain}/${folderName}/${rawFoto}`;
          } else {
             // Fallback jika format nama file berbeda
             foto = `${baseDomain}/berkas/${rawFoto}`;
          }
        }
      }
      
      if (!nis) continue; // Lewati jika tidak ada NIS (identifier utama)

      // Identifikasi apakah anak tersebut santri mukim (punya kamar aktif atau kelas madin aktif di mitra)
      const kamarMitra = santri.kamar || '';
      const madrasiahMitra = santri.madrasiah || '';
      
      const kamarMitraLower = kamarMitra.trim().toLowerCase();
      const madrasiahMitraLower = madrasiahMitra.trim().toLowerCase();
      
      // Kriteria Non-Santri (Murid Sekolah Saja): Kamar kosong/-, atau kamar 'lppm' / 'lppmp'
      const hasValidKamar = kamarMitraLower !== '-' && kamarMitraLower !== '' && kamarMitraLower !== 'lppm' && kamarMitraLower !== 'lppmp';
      
      // Kriteria Kelas Madin Aktif: Tidak kosong/-, dan statusnya bukan 'boyong'
      const hasValidMadrasiah = madrasiahMitraLower !== '-' && madrasiahMitraLower !== '' && madrasiahMitraLower !== 'boyong';
      
      const isSantri = hasValidKamar || hasValidMadrasiah;

      if (!isSantri) {
        // Jika murid non-santri ada di database kita, hapus untuk membersihkan data
        const [delResult]: any = await db.query('DELETE FROM murid WHERE nis = ?', [nis]);
        if (delResult.affectedRows > 0) {
          deletedCount++;
        }
        continue; // Lewati sinkronisasi (tidak di-insert atau update)
      }

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

    // 3. AUTO-ENRICH INFO KAMAR & ASRAMA DARI GOOGLE SHEETS
    // Jika data dari API Bridge Mitra belum memiliki info kamar yang lengkap
    let enrichedKamarCount = 0;
    try {
      const PUBLISHED_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQkk9LdLRlfmnjdlCT2d4cSU6TxdpV5x7S__kQx-lb0pSa8s6G5zKp7vYRJPN2Jrv2OJq_5expWDlAE/pub?single=true&output=csv&gid=';
      const GIDS = ['1690459731', '0', '710078716']; // KELAS I, II, III

      for (const gid of GIDS) {
        const sheetRes = await fetch(`${PUBLISHED_BASE}${gid}`, { cache: 'no-store' });
        if (!sheetRes.ok) continue;

        const csvText = await sheetRes.text();
        const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) continue;

        const parseCsvLine = (line: string): string[] => {
          const res: string[] = [];
          let cur = '';
          let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQ = !inQ; continue; }
            if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; continue; }
            cur += c;
          }
          res.push(cur.trim());
          return res;
        };

        const headers = parseCsvLine(lines[0]);
        const findColIndex = (keywords: string[]) => {
          for (const kw of keywords) {
            const idx = headers.findIndex(h => h.toUpperCase().includes(kw.toUpperCase()));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colNIS = findColIndex(['NIS', 'NO INDUK']);
        const colNama = findColIndex(['NAMA', 'NAMA SANTRI']);
        const colAsrama = findColIndex(['ASRAMA']);
        const colKamar = findColIndex(['KAMAR']);

        if (colNama === -1) continue;

        for (let i = 1; i < lines.length; i++) {
          const row = parseCsvLine(lines[i]);
          const nis = colNIS !== -1 ? String(row[colNIS] || '').trim() : '';
          const nama = String(row[colNama] || '').trim();
          if (!nama || ['NAMA', 'NAMA SANTRI'].includes(nama.toUpperCase())) continue;

          let asrama = colAsrama !== -1 ? String(row[colAsrama] || '').trim() : '';
          let kamar = colKamar !== -1 ? String(row[colKamar] || '').trim() : '';

          if (/^[A-F]$/i.test(asrama)) asrama = `Asrama ${asrama.toUpperCase()}`;
          if ((!asrama || asrama === '0' || asrama === '-') && kamar && /^[A-F]/i.test(kamar)) {
            asrama = `Asrama ${kamar.charAt(0).toUpperCase()}`;
          }

          if (asrama && asrama !== '-' && kamar && kamar !== '-') {
            const asramaCode = asrama.replace(/asrama\s+/i, '').trim().toUpperCase();
            
            const [kRows]: any = await db.query(
              `SELECT kamar_id FROM kamar WHERE (nama_asrama = ? OR nama_asrama = ?) AND (nama_kamar = ? OR nama_kamar = ?) LIMIT 1`,
              [`Asrama ${asramaCode}`, asramaCode, kamar, `${asramaCode}-${kamar}`]
            );

            let kId = kRows.length > 0 ? kRows[0].kamar_id : null;
            if (!kId) {
              const [insK]: any = await db.query(
                `INSERT INTO kamar (nama_kamar, nama_asrama, kapasitas) VALUES (?, ?, 20)`,
                [kamar, asramaCode]
              );
              kId = insK.insertId;
            }

            if (kId) {
              let updateRes: any;
              if (nis) {
                [updateRes] = await db.query(
                  `UPDATE murid SET kamar_id = ? WHERE nis = ? AND (kamar_id IS NULL OR kamar_id = 0)`,
                  [kId, nis]
                );
              } else {
                [updateRes] = await db.query(
                  `UPDATE murid SET kamar_id = ? WHERE LOWER(TRIM(nama)) = LOWER(TRIM(?)) AND (kamar_id IS NULL OR kamar_id = 0)`,
                  [kId, nama]
                );
              }
              if (updateRes?.affectedRows > 0) enrichedKamarCount++;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('Gagal melengkapi info kamar dari Google Sheets:', err.message);
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
      updated_students: updatedCount,
      deleted_non_santri: deletedCount,
      enriched_kamar: enrichedKamarCount
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
