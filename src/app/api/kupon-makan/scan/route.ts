import { NextResponse, NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureKuponMakanDB, detectActiveSesiWIB } from '@/lib/ensureKuponMakanDB';
import { resolveAsrama } from '@/lib/auth/resolveAsrama';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await ensureKuponMakanDB();

    const body = await request.json();
    const { barcodeData, sesi: requestedSesi, forceDispensasi, catatanDispensasi } = body;

    if (!barcodeData || String(barcodeData).trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Kode barcode atau NIS santri wajib diisi.' },
        { status: 400 }
      );
    }

    // 0. RBAC: Validasi autentikasi & peran operator
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Silakan login terlebih dahulu.' }, { status: 401 });
    }
    const payload = verifyToken(token) as any;
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token tidak valid.' }, { status: 401 });
    }

    const userId = payload.userId || payload.id;
    let role = (payload.role || '').toLowerCase();
    let isPengasuhOrPengurus = !!(
      payload.isPengasuh ||
      payload.is_pengasuh ||
      payload.isPengurusAsrama ||
      payload.is_pengurus_asrama ||
      role.includes('pengasuh') ||
      role.includes('pengurus')
    );

    if (userId) {
      try {
        const [uRows] = await pool.execute<RowDataPacket[]>('SELECT role, is_pengasuh, is_pengurus_asrama FROM users WHERE id = ? LIMIT 1', [userId]);
        if (uRows.length > 0) {
          const dbRole = (uRows[0].role || '').toLowerCase();
          if (dbRole) role = dbRole;
          if (uRows[0].is_pengasuh || dbRole.includes('pengasuh')) isPengasuhOrPengurus = true;
          if (uRows[0].is_pengurus_asrama || dbRole.includes('pengurus')) isPengasuhOrPengurus = true;
        }
      } catch (_) {}
    }

    const isMurniGuru = role === 'guru' && !isPengasuhOrPengurus;
    const isAllowed = (['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'pengurus'].includes(role) || isPengasuhOrPengurus) && !isMurniGuru;
    if (!isAllowed) {
      return NextResponse.json({ success: false, message: 'Akses ditolak: Anda tidak memiliki izin untuk memindai kupon makan.' }, { status: 403 });
    }

    // Tentukan apakah operator memiliki batasan asrama
    const canSwitchAsrama = ['admin', 'staff'].includes(role);
    let operatorAsrama: string | null = null;
    if (!canSwitchAsrama) {
      try {
        operatorAsrama = await resolveAsrama(
          userId,
          role,
          payload.username || '',
          payload.asrama || payload.namaAsrama || null
        );
      } catch (_) {}
    }

    let operatorName = payload.nama || payload.username || 'Petugas Kantin';

    const rawCode = String(barcodeData).trim();
    const digitsOnly = rawCode.replace(/\D/g, '');

    // Waktu & Tanggal WIB
    const nowWib = new Date();
    const tanggalHariIni = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(nowWib); // YYYY-MM-DD
    const waktuScan = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(nowWib).replace(/\./g, ':');

    // Deteksi sesi aktif dari database jika tidak dipilih manual
    const detectedSesi = await detectActiveSesiWIB();
    const activeSesi = requestedSesi && String(requestedSesi).trim() !== ''
      ? String(requestedSesi).trim()
      : detectedSesi.activeKode;

    // 1. CARI DATA SANTRI (Berdasarkan barcode_id atau NIS)
    let [muridRows] = await pool.query<RowDataPacket[]>(
      `SELECT m.murid_id, m.nama, m.nis, m.barcode_id, m.foto, 
              k.nama_asrama, k.nama_kamar 
       FROM murid m 
       LEFT JOIN kamar k ON m.kamar_id = k.kamar_id 
       WHERE TRIM(m.barcode_id) = ? OR TRIM(m.nis) = ? OR TRIM(m.barcode_id) = ? OR TRIM(m.nis) = ?
       LIMIT 1`,
      [rawCode, rawCode, digitsOnly, digitsOnly]
    );

    // Fallback jika belum ketemu dan digit >= 5
    if (muridRows.length === 0 && digitsOnly.length >= 5) {
      [muridRows] = await pool.query<RowDataPacket[]>(
        `SELECT m.murid_id, m.nama, m.nis, m.barcode_id, m.foto, 
                k.nama_asrama, k.nama_kamar 
         FROM murid m 
         LEFT JOIN kamar k ON m.kamar_id = k.kamar_id 
         WHERE m.nis LIKE ? OR m.barcode_id LIKE ?
         LIMIT 1`,
        [`%${digitsOnly}%`, `%${digitsOnly}%`]
      );
    }

    if (muridRows.length === 0) {
      return NextResponse.json({
        success: false,
        status: 'TIDAK_DITEMUKAN',
        message: `Santri dengan kode "${rawCode}" tidak terdaftar di sistem.`,
      }, { status: 404 });
    }

    const santri = muridRows[0];
    const santriAsrama = santri.nama_asrama ? (santri.nama_asrama.startsWith('Asrama') ? santri.nama_asrama : `Asrama ${santri.nama_asrama}`) : '-';
    const santriKamar = santri.nama_kamar || '-';

    // Cek cross-asrama warning: pengurus/pengasuh scan santri dari asrama berbeda
    let crossAsramaWarning = false;
    let crossAsramaCatatan = '';
    if (operatorAsrama && santriAsrama !== '-') {
      const normOperator = operatorAsrama.replace(/asrama\s+/i, '').trim().toUpperCase();
      const normSantri = santriAsrama.replace(/asrama\s+/i, '').trim().toUpperCase();
      if (normOperator !== normSantri && normOperator !== 'SEMUA') {
        crossAsramaWarning = true;
        crossAsramaCatatan = `⚠️ Cross-Asrama: Santri dari ${santriAsrama}, di-scan oleh operator ${operatorAsrama}`;
      }
    }

    // 2. CEK APAKAH SUDAH MENGAMBIL MAKAN DI SESI INI HARI INI
    const [existingScans] = await pool.query<RowDataPacket[]>(
      `SELECT id, waktu_scan, status, catatan 
       FROM riwayat_makan 
       WHERE murid_id = ? AND tanggal = ? AND sesi = ? AND status IN ('berhasil', 'dispensasi')
       ORDER BY id DESC LIMIT 1`,
      [santri.murid_id, tanggalHariIni, activeSesi]
    );

    if (existingScans.length > 0) {
      const prior = existingScans[0];
      return NextResponse.json({
        success: false,
        status: 'SUDAH_AMBIL',
        message: `Santri sudah mengambil jatah makan sesi ${activeSesi.toUpperCase()} hari ini pada pukul ${prior.waktu_scan} WIB.`,
        crossAsramaWarning,
        data: {
          santri: {
            murid_id: santri.murid_id,
            nama: santri.nama,
            nis: santri.nis,
            asrama: santriAsrama,
            kamar: santriKamar,
            foto: santri.foto
          },
          sesi: activeSesi,
          waktu_sebelumnya: prior.waktu_scan,
          status_sebelumnya: prior.status
        }
      });
    }

    // 3. CEK DATA TAGIHAN / PEMBAYARAN (Ketentuan: Tagihan Belum Lunas)
    const [tunggakanRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, nama_tagihan, nominal, status, periode, kategori 
       FROM billing 
       WHERE (nis = ? OR LOWER(TRIM(nama_santri)) = LOWER(TRIM(?))) 
         AND status = 'Belum' AND nominal > 0
       ORDER BY id ASC`,
      [santri.nis, santri.nama]
    );

    const hasTunggakan = tunggakanRows.length > 0;
    const totalTunggakan = tunggakanRows.reduce((acc, curr) => acc + Number(curr.nominal || 0), 0);

    // Ambil setting mode_uji_coba
    const [settingRows] = await pool.query<RowDataPacket[]>(
      `SELECT nilai FROM pengaturan_kupon_makan WHERE nama_pengaturan = 'mode_uji_coba' LIMIT 1`
    );
    const isModeUjiCoba = settingRows.length > 0 ? settingRows[0].nilai === '1' : true;

    // 4. KONDISI: DIPAKSA DISPENSASI OLEH OPERATOR
    if (forceDispensasi) {
      const catatanBase = catatanDispensasi || (hasTunggakan ? `Dispensasi darurat (Ada tanggungan Rp ${totalTunggakan.toLocaleString('id-ID')})` : 'Dispensasi manual operator');
      const catatanFinal = crossAsramaWarning ? `${catatanBase} | ${crossAsramaCatatan}` : catatanBase;

      const [insertRes] = await pool.query<ResultSetHeader>(
        `INSERT INTO riwayat_makan (murid_id, nis, nama, asrama, kamar, tanggal, sesi, waktu_scan, status, operator, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dispensasi', ?, ?)`,
        [santri.murid_id, santri.nis, santri.nama, santriAsrama, santriKamar, tanggalHariIni, activeSesi, waktuScan, operatorName, catatanFinal]
      );

      return NextResponse.json({
        success: true,
        status: 'DISPENSASI',
        message: 'Kupon makan diberikan melalui jalur DISPENSASI.',
        crossAsramaWarning,
        riwayatId: insertRes.insertId,
        data: {
          santri: {
            murid_id: santri.murid_id,
            nama: santri.nama,
            nis: santri.nis,
            asrama: santriAsrama,
            kamar: santriKamar,
            foto: santri.foto
          },
          sesi: activeSesi,
          waktu: waktuScan,
          tunggakan: tunggakanRows,
          totalTunggakan,
          catatan: catatanFinal
        }
      });
    }

    // 5. KONDISI: MEMILIKI TUNGGAKAN DAN TIDAK DISPENSASI
    if (hasTunggakan) {
      const ringkasanTunggakan = tunggakanRows.map(t => `${t.nama_tagihan} (${t.periode}): Rp ${Number(t.nominal).toLocaleString('id-ID')}`).join(', ');
      const catatanTunggakan = crossAsramaWarning ? `${isModeUjiCoba ? 'Dalam Masa Uji Coba Lapangan' : ''} | ${crossAsramaCatatan}` : (isModeUjiCoba ? 'Dalam Masa Uji Coba Lapangan' : null);

      // Catat riwayat percobaan gagal agar terekap di evaluasi lapangan
      await pool.query(
        `INSERT INTO riwayat_makan (murid_id, nis, nama, asrama, kamar, tanggal, sesi, waktu_scan, status, alasan, operator, catatan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ditolak', ?, ?, ?)`,
        [santri.murid_id, santri.nis, santri.nama, santriAsrama, santriKamar, tanggalHariIni, activeSesi, waktuScan, 'Tunggakan: ' + ringkasanTunggakan, operatorName, catatanTunggakan]
      );

      return NextResponse.json({
        success: false,
        status: 'TUNGGAKAN',
        isModeUjiCoba,
        crossAsramaWarning,
        message: `MOHON MAAF: Masih terdapat tanggungan pembayaran. Silakan konfirmasi ke bagian administrasi.`,
        data: {
          santri: {
            murid_id: santri.murid_id,
            nama: santri.nama,
            nis: santri.nis,
            asrama: santriAsrama,
            kamar: santriKamar,
            foto: santri.foto
          },
          sesi: activeSesi,
          waktu: waktuScan,
          tunggakan: tunggakanRows,
          totalTunggakan
        }
      });
    }

    // 6. KONDISI: LUNAS & BERHASIL (KUPON SAH)
    const catatanBerhasil = crossAsramaWarning ? crossAsramaCatatan : null;
    const [insertRes] = await pool.query<ResultSetHeader>(
      `INSERT INTO riwayat_makan (murid_id, nis, nama, asrama, kamar, tanggal, sesi, waktu_scan, status, operator, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'berhasil', ?, ?)`,
      [santri.murid_id, santri.nis, santri.nama, santriAsrama, santriKamar, tanggalHariIni, activeSesi, waktuScan, operatorName, catatanBerhasil]
    );

    return NextResponse.json({
      success: true,
      status: 'BERHASIL',
      message: 'Kupon makan SAH. Silakan ambil jatah makan.',
      crossAsramaWarning,
      riwayatId: insertRes.insertId,
      data: {
        santri: {
          murid_id: santri.murid_id,
          nama: santri.nama,
          nis: santri.nis,
          asrama: santriAsrama,
          kamar: santriKamar,
          foto: santri.foto
        },
        sesi: activeSesi,
        waktu: waktuScan
      }
    });

  } catch (error: any) {
    console.error('Error in POST /api/kupon-makan/scan:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan sistem: ' + error.message },
      { status: 500 }
    );
  }
}
