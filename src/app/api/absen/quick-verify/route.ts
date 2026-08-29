import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 400 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload as any).type !== 'quick_absen') {
      let waktuTenggang = 3;
      try {
        const [stgRows] = await pool.execute<RowDataPacket[]>(
          'SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = "waktu_tenggang_absensi" LIMIT 1'
        );
        if (stgRows.length > 0 && stgRows[0].nilai) {
          const parsed = parseInt(stgRows[0].nilai);
          if (!isNaN(parsed) && parsed > 0) waktuTenggang = parsed;
        }
      } catch (_) {}
      return NextResponse.json({ error: `Token tidak valid atau sudah kadaluarsa (${waktuTenggang} jam)` }, { status: 401 });
    }

    const { guru_id, guru_nama, user_id, jadwal_id, tipe, date } = payload as any;

    // Set session cookie agar user dianggap terautentikasi sebagai guru ini
    const authPayload = {
      userId: user_id || 0,
      username: `guru_${guru_id}`,
      role: 'guru',
      guruId: guru_id,
      nama: guru_nama
    };

    const sessionToken = signToken(authPayload);
    const cookieStore = await cookies();
    cookieStore.set('token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Ambil detail jadwal & murid sesuai tipe
    let jadwalDetail: any = null;
    let muridList: any[] = [];

    const targetDate = date || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());

    if (tipe === 'madin') {
      const [primaryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari, j.guru_id,
                j.kelas_madin_id as kelas_id, k.nama_kelas
         FROM jadwal_madin j
         JOIN kelas_madin k ON j.kelas_madin_id = k.kelas_id
         WHERE j.jadwal_id = ?`,
        [jadwal_id]
      );
      if (primaryRows.length > 0) {
        const primary = primaryRows[0];
        // Cari semua jadwal gabungan guru yang sama pada hari & jam yang sama
        const [allCombinedRows] = await pool.execute<RowDataPacket[]>(
          `SELECT j.jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
                  j.kelas_madin_id as kelas_id, k.nama_kelas
           FROM jadwal_madin j
           JOIN kelas_madin k ON j.kelas_madin_id = k.kelas_id
           WHERE (j.guru_id = ? OR j.jadwal_id = ?) AND j.hari = ? AND j.jam_mulai = ? AND j.jam_selesai = ?`,
          [primary.guru_id || 0, primary.jadwal_id, primary.hari, primary.jam_mulai, primary.jam_selesai]
        );
        const combinedSchedules = allCombinedRows.length > 0 ? allCombinedRows : [primary];
        const combinedKelasIds = Array.from(new Set(combinedSchedules.map((s: any) => s.kelas_id)));
        const combinedJadwalIds = Array.from(new Set(combinedSchedules.map((s: any) => s.jadwal_id)));
        const combinedKelasNama = Array.from(new Set(combinedSchedules.map((s: any) => s.nama_kelas))).join(' & ');
        const combinedMapel = Array.from(new Set(combinedSchedules.map((s: any) => s.mata_pelajaran).filter(Boolean))).join(' & ');

        jadwalDetail = {
          ...primary,
          nama_kelas: combinedKelasNama,
          mata_pelajaran: combinedMapel || primary.mata_pelajaran,
          jadwal_ids: combinedJadwalIds,
          kelas_ids: combinedKelasIds,
        };

        const placeholders = combinedKelasIds.map(() => '?').join(',');
        const [mRows] = await pool.execute<RowDataPacket[]>(
          `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.nama_wali, m.alamat, m.jenis_kelamin,
                  m.kelas_madin_id, m.kelas_madin_2_id, k.nama_kelas
           FROM murid m
           JOIN kelas_madin k ON (m.kelas_madin_id = k.kelas_id OR m.kelas_madin_2_id = k.kelas_id)
           WHERE k.kelas_id IN (${placeholders})
           ORDER BY k.nama_kelas ASC, m.nama ASC`,
          [...combinedKelasIds]
        );
        muridList = mRows;
      }
    } else if (tipe === 'quran') {
      const [primaryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari, j.guru_id,
                j.kelas_quran_id as kelas_id, k.nama_kelas
         FROM jadwal_quran j
         JOIN kelas_quran k ON j.kelas_quran_id = k.id
         WHERE j.id = ?`,
        [jadwal_id]
      );
      if (primaryRows.length > 0) {
        const primary = primaryRows[0];
        const [allCombinedRows] = await pool.execute<RowDataPacket[]>(
          `SELECT j.id as jadwal_id, j.jam_mulai, j.jam_selesai, j.mata_pelajaran, j.hari,
                  j.kelas_quran_id as kelas_id, k.nama_kelas
           FROM jadwal_quran j
           JOIN kelas_quran k ON j.kelas_quran_id = k.id
           WHERE (j.guru_id = ? OR j.id = ?) AND j.hari = ? AND j.jam_mulai = ? AND j.jam_selesai = ?`,
          [primary.guru_id || 0, primary.jadwal_id, primary.hari, primary.jam_mulai, primary.jam_selesai]
        );
        const combinedSchedules = allCombinedRows.length > 0 ? allCombinedRows : [primary];
        const combinedKelasIds = Array.from(new Set(combinedSchedules.map((s: any) => s.kelas_id)));
        const combinedJadwalIds = Array.from(new Set(combinedSchedules.map((s: any) => s.jadwal_id)));
        const combinedKelasNama = Array.from(new Set(combinedSchedules.map((s: any) => s.nama_kelas))).join(' & ');
        const combinedMapel = Array.from(new Set(combinedSchedules.map((s: any) => s.mata_pelajaran).filter(Boolean))).join(' & ');

        jadwalDetail = {
          ...primary,
          nama_kelas: combinedKelasNama,
          mata_pelajaran: combinedMapel || primary.mata_pelajaran,
          jadwal_ids: combinedJadwalIds,
          kelas_ids: combinedKelasIds,
        };

        const placeholders = combinedKelasIds.map(() => '?').join(',');
        const [mRows] = await pool.execute<RowDataPacket[]>(
          `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.nama_wali, m.alamat, m.jenis_kelamin,
                  m.kelas_quran_id, k.nama_kelas
           FROM murid m
           JOIN kelas_quran k ON m.kelas_quran_id = k.id
           WHERE k.id IN (${placeholders})
           ORDER BY k.nama_kelas ASC, m.nama ASC`,
          [...combinedKelasIds]
        );
        muridList = mRows;
      }
    } else if (tipe === 'kamar' || tipe === 'kegiatan') {
      const [primaryRows] = await pool.execute<RowDataPacket[]>(
        `SELECT j.kegiatan_id as jadwal_id, j.jam_mulai, j.jam_selesai, j.nama_kegiatan as mata_pelajaran, j.hari, j.guru_id,
                j.kamar_id as kelas_id, k.nama_kamar as nama_kelas
         FROM jadwal_kegiatan j
         JOIN kamar k ON j.kamar_id = k.kamar_id
         WHERE j.kegiatan_id = ?`,
        [jadwal_id]
      );
      if (primaryRows.length > 0) {
        const primary = primaryRows[0];
        const [allCombinedRows] = await pool.execute<RowDataPacket[]>(
          `SELECT j.kegiatan_id as jadwal_id, j.jam_mulai, j.jam_selesai, j.nama_kegiatan as mata_pelajaran, j.hari,
                  j.kamar_id as kelas_id, k.nama_kamar as nama_kelas
           FROM jadwal_kegiatan j
           JOIN kamar k ON j.kamar_id = k.kamar_id
           WHERE (j.guru_id = ? OR j.kegiatan_id = ?) AND j.hari = ? AND j.jam_mulai = ? AND j.jam_selesai = ?`,
          [primary.guru_id || 0, primary.jadwal_id, primary.hari, primary.jam_mulai, primary.jam_selesai]
        );
        const combinedSchedules = allCombinedRows.length > 0 ? allCombinedRows : [primary];
        const combinedKelasIds = Array.from(new Set(combinedSchedules.map((s: any) => s.kelas_id)));
        const combinedJadwalIds = Array.from(new Set(combinedSchedules.map((s: any) => s.jadwal_id)));
        const combinedKelasNama = Array.from(new Set(combinedSchedules.map((s: any) => s.nama_kamar || s.nama_kelas))).join(' & ');
        const combinedMapel = Array.from(new Set(combinedSchedules.map((s: any) => s.mata_pelajaran).filter(Boolean))).join(' & ');

        jadwalDetail = {
          ...primary,
          nama_kelas: combinedKelasNama,
          mata_pelajaran: combinedMapel || primary.mata_pelajaran,
          jadwal_ids: combinedJadwalIds,
          kelas_ids: combinedKelasIds,
        };

        const placeholders = combinedKelasIds.map(() => '?').join(',');
        const [mRows] = await pool.execute<RowDataPacket[]>(
          `SELECT m.murid_id, m.nis, m.nama, m.nama_panggilan, m.foto, m.nama_wali, m.alamat, m.jenis_kelamin,
                  m.kamar_id, k.nama_kamar as nama_kelas
           FROM murid m
           JOIN kamar k ON m.kamar_id = k.kamar_id
           WHERE k.kamar_id IN (${placeholders})
           ORDER BY k.nama_kamar ASC, m.nama ASC`,
          [...combinedKelasIds]
        );
        muridList = mRows;
      }
    }

    if (!jadwalDetail) {
      return NextResponse.json({ error: 'Detail jadwal tidak ditemukan di DB' }, { status: 404 });
    }

    // ====== VALIDASI WAKTU KETAT: cek window akses berdasarkan jadwal ======
    try {
      const nowWIB = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const todayWIB = nowWIB.toISOString().slice(0, 10); // YYYY-MM-DD

      // Validasi tanggal: token harus untuk hari ini
      if (targetDate !== todayWIB) {
        return NextResponse.json({
          error: `Link absensi ini untuk tanggal ${targetDate}, bukan hari ini (${todayWIB}). Silakan gunakan link terbaru.`
        }, { status: 401 });
      }

      // Parse jam_mulai dan jam_selesai jadwal
      const parseTimeSecs = (t: string): number => {
        if (!t) return 0;
        const parts = t.split(':').map(Number);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      };

      const nowSecs = nowWIB.getHours() * 3600 + nowWIB.getMinutes() * 60 + nowWIB.getSeconds();
      const mulaiSecs = parseTimeSecs(jadwalDetail.jam_mulai);
      const selesaiSecs = parseTimeSecs(jadwalDetail.jam_selesai);

      // Window valid: waktu_mulai_absensi menit sebelum mulai s.d. selesai + waktu_tenggang_absensi jam
      let waktuTenggangWindow = 3;
      let waktuMulaiMinutes = 30;
      try {
        const [stgRows2] = await pool.execute<RowDataPacket[]>(
          'SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ("waktu_tenggang_absensi", "waktu_mulai_absensi")'
        );
        stgRows2.forEach((row: any) => {
          if (row.nama_pengaturan === 'waktu_tenggang_absensi') {
            const p = parseInt(row.nilai);
            if (!isNaN(p) && p > 0) waktuTenggangWindow = p;
          } else if (row.nama_pengaturan === 'waktu_mulai_absensi') {
            const p = parseInt(row.nilai);
            if (!isNaN(p) && p >= 0) waktuMulaiMinutes = p;
          }
        });
      } catch (_) {}

      const windowStart = mulaiSecs - waktuMulaiMinutes * 60;
      const windowEnd = selesaiSecs + waktuTenggangWindow * 3600;

      if (nowSecs < windowStart) {
        const selisihMenit = Math.ceil((windowStart - nowSecs) / 60);
        return NextResponse.json({
          error: `Absensi belum bisa diisi. Jadwal dimulai pukul ${jadwalDetail.jam_mulai}. Tautan ini dapat diakses ${waktuMulaiMinutes} menit sebelum jadwal dimulai (silakan coba ${selisihMenit} menit lagi).`
        }, { status: 401 });
      }

      if (nowSecs > windowEnd) {
        return NextResponse.json({
          error: `Waktu absensi telah berakhir. Jadwal ${jadwalDetail.jam_mulai}–${jadwalDetail.jam_selesai} hanya dapat diakses maksimal hingga ${waktuTenggangWindow} jam setelah jam selesai.`
        }, { status: 401 });
      }
    } catch (timeCheckErr) {
      // Jika validasi waktu error, tetap lanjutkan (jangan block user)
      console.warn('[quick-verify] Gagal validasi waktu:', timeCheckErr);
    }
    // ====== END VALIDASI WAKTU ======


    // Ambil data absensi yang sudah pernah tersimpan untuk tanggal ini dari semua jadwal_ids & jadwal kelompok (Team Teaching)
    let existingMap: { [murid_id: number]: string } = {};
    const jIds = jadwalDetail.jadwal_ids || [jadwal_id];
    let siblingJadwalIds: any[] = [...jIds];

    try {
      if (tipe === 'madin') {
        const [sibRows]: any = await pool.execute(
          `SELECT j2.jadwal_id 
           FROM jadwal_madin j1 
           JOIN jadwal_madin j2 ON j1.kelas_madin_id = j2.kelas_madin_id AND j1.hari = j2.hari
           WHERE j1.jadwal_id IN (${jIds.map(() => '?').join(',')})`,
          jIds
        );
        siblingJadwalIds = Array.from(new Set([...siblingJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      } else if (tipe === 'quran') {
        const [sibRows]: any = await pool.execute(
          `SELECT j2.id as jadwal_id 
           FROM jadwal_quran j1 
           JOIN jadwal_quran j2 ON j1.kelas_quran_id = j2.kelas_quran_id AND j1.hari = j2.hari
           WHERE j1.id IN (${jIds.map(() => '?').join(',')})`,
          jIds
        );
        siblingJadwalIds = Array.from(new Set([...siblingJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      } else if (tipe === 'kamar' || tipe === 'kegiatan') {
        const [sibRows]: any = await pool.execute(
          `SELECT j2.kegiatan_id as jadwal_id 
           FROM jadwal_kegiatan j1 
           JOIN jadwal_kegiatan j2 ON j1.kamar_id = j2.kamar_id AND j1.hari = j2.hari
           WHERE j1.kegiatan_id IN (${jIds.map(() => '?').join(',')})`,
          jIds
        );
        siblingJadwalIds = Array.from(new Set([...siblingJadwalIds, ...sibRows.map((r: any) => r.jadwal_id)]));
      }
    } catch (e) {
      console.warn('Find sibling schedules notice in quick-verify:', e);
    }

    const placeholdersJadwal = siblingJadwalIds.map(() => '?').join(',');

    let existingQuery = '';
    if (tipe === 'madin') existingQuery = `SELECT murid_id, status FROM absensi WHERE jadwal_madin_id IN (${placeholdersJadwal}) AND tanggal = ?`;
    else if (tipe === 'quran') existingQuery = `SELECT murid_id, status FROM absensi_quran WHERE jadwal_quran_id IN (${placeholdersJadwal}) AND tanggal = ?`;
    else if (tipe === 'kamar' || tipe === 'kegiatan') existingQuery = `SELECT murid_id, status FROM absensi_kegiatan WHERE kegiatan_id IN (${placeholdersJadwal}) AND tanggal = ?`;

    if (existingQuery) {
      const [existingRows] = await pool.execute<RowDataPacket[]>(existingQuery, [...siblingJadwalIds, targetDate]);
      (existingRows || []).forEach(r => {
        const rawSt = (r.status || '').toString().trim().toLowerCase();
        if (rawSt === 'izin') existingMap[r.murid_id] = 'izin';
        else if (rawSt === 'sakit') existingMap[r.murid_id] = 'sakit';
        else if (rawSt === 'alpha' || rawSt === 'alpa' || rawSt === '') existingMap[r.murid_id] = 'alpha';
        else existingMap[r.murid_id] = 'hadir';
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        guru_id,
        guru_nama,
        tipe,
        date: targetDate,
        jadwal: jadwalDetail,
        murid: muridList,
        existingAbsensi: existingMap
      }
    });
  } catch (error: any) {
    console.error('Error quick verify:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
