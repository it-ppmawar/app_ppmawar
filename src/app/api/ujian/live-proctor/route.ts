import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureUjianDB();

    const { searchParams } = new URL(request.url);
    const ujianId = searchParams.get('ujian_id');

    if (!ujianId) {
      return NextResponse.json({ error: 'Parameter ujian_id diperlukan.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    // 1. Ambil Data Master Ujian & Kelas Target
    const [examRows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.judul, u.mata_pelajaran, u.kelas_madin_id, u.durasi_menit, 
              u.passing_grade, u.anti_curang, u.max_pelanggaran,
              km.nama_kelas,
              (SELECT COUNT(*) FROM ujian_soal WHERE ujian_id = u.id) as total_soal,
              s.token_ujian, s.status_sesi
       FROM ujian_madin u
       LEFT JOIN kelas_madin km ON u.kelas_madin_id = km.kelas_id
       LEFT JOIN ujian_sesi_pengawas s ON u.id = s.ujian_id
       WHERE u.id = ? LIMIT 1`,
      [ujianId]
    );

    if (examRows.length === 0) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    const exam = examRows[0];
    const totalSoalExam = Number(exam.total_soal) || 0;

    // 2. Ambil Daftar Seluruh Santri di Kelas Tersebut
    let muridList: any[] = [];
    if (exam.kelas_madin_id) {
      const [mRows] = await pool.execute<RowDataPacket[]>(
        `SELECT murid_id, nama, nama as nama_murid, nis, jenis_kelamin
         FROM murid 
         WHERE kelas_madin_id = ? OR kelas_madin_2_id = ?
         ORDER BY nama ASC`,
        [exam.kelas_madin_id, exam.kelas_madin_id]
      );
      muridList = mRows;
    }

    // 3. Ambil Data Sesi Live Proctoring
    const [liveRows] = await pool.execute<RowDataPacket[]>(
      `SELECT murid_id, status_pengerjaan, jumlah_terjawab, jumlah_ragu, total_soal,
              jumlah_pelanggaran, is_disqualified, log_pelanggaran,
              waktu_masuk, last_heartbeat,
              TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) as seconds_since_heartbeat
       FROM ujian_live_proctor
       WHERE ujian_id = ?`,
      [ujianId]
    );
    const liveMap = new Map<number, any>();
    liveRows.forEach((row: any) => {
      liveMap.set(row.murid_id, row);
    });

    // 4. Ambil Data Hasil Pengerjaan (Bagi yang sudah submit atau didiskualifikasi permanen)
    const [hasilRows] = await pool.execute<RowDataPacket[]>(
      `SELECT murid_id, skor_akhir, jumlah_benar, jumlah_salah, total_soal,
              status_lulus, status_koreksi, jumlah_pelanggaran, is_disqualified,
              log_pelanggaran, waktu_mulai, waktu_selesai, durasi_detik
       FROM ujian_hasil_santri
       WHERE ujian_id = ?`,
      [ujianId]
    );
    const hasilMap = new Map<number, any>();
    hasilRows.forEach((row: any) => {
      hasilMap.set(row.murid_id, row);
    });

    // Jika murid di kelas kosong (misal ujian umum tanpa kelas_madin_id), satukan murid dari hasil & live atau ambil seluruh santri
    if (muridList.length === 0) {
      const allMuridIds = new Set<number>();
      liveRows.forEach((r: any) => allMuridIds.add(r.murid_id));
      hasilRows.forEach((r: any) => allMuridIds.add(r.murid_id));
      if (allMuridIds.size > 0) {
        const idArr = Array.from(allMuridIds);
        const [fallbackMurid] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nama, nama as nama_murid, nis, jenis_kelamin
           FROM murid 
           WHERE murid_id IN (${idArr.map(() => '?').join(',')})
           ORDER BY nama ASC`,
          idArr
        );
        muridList = fallbackMurid;
      } else {
        const [fallbackAll] = await pool.execute<RowDataPacket[]>(
          `SELECT murid_id, nama, nama as nama_murid, nis, jenis_kelamin
           FROM murid 
           ORDER BY nama ASC LIMIT 500`
        );
        muridList = fallbackAll;
      }
    }

    // 5. Gabungkan dan kalkulasikan status tiap peserta
    let countSedang = 0;
    let countBelum = 0;
    let countSelesai = 0;
    let countDiskualifikasi = 0;

    const participants = muridList.map((m: any) => {
      const live = liveMap.get(m.murid_id);
      const hasil = hasilMap.get(m.murid_id);

      let status = 'belum_masuk';
      let isLiveOnline = false;

      if (hasil) {
        if (hasil.is_disqualified) {
          status = 'didiskualifikasi';
          countDiskualifikasi++;
        } else {
          status = 'selesai';
          countSelesai++;
        }
      } else if (live) {
        if (live.is_disqualified) {
          status = 'didiskualifikasi';
          countDiskualifikasi++;
        } else if (live.status_pengerjaan === 'selesai') {
          status = 'selesai';
          countSelesai++;
        } else {
          const secs = live.seconds_since_heartbeat !== null ? Number(live.seconds_since_heartbeat) : 999;
          if (secs <= 40) {
            status = 'sedang_mengerjakan';
            isLiveOnline = true;
            countSedang++;
          } else {
            status = 'terputus';
            countSedang++; // Tetap dihitung dalam proses pengerjaan
          }
        }
      } else {
        status = 'belum_masuk';
        countBelum++;
      }

      // Hitung rincian soal
      const totalSoal = totalSoalExam || (live?.total_soal) || (hasil?.total_soal) || 0;
      const terjawab = (live ? live.jumlah_terjawab : (hasil ? (hasil.jumlah_benar + hasil.jumlah_salah) : 0)) || 0;
      const ragu = (live ? live.jumlah_ragu : 0) || 0;
      const belum = Math.max(totalSoal - terjawab, 0);

      // Pelanggaran & log
      let logs: any[] = [];
      try {
        const rawLog = live?.log_pelanggaran || hasil?.log_pelanggaran;
        if (rawLog) {
          logs = typeof rawLog === 'string' ? JSON.parse(rawLog) : rawLog;
        }
      } catch (e) {
        logs = [];
      }

      let pelanggaranCount = Number(live?.jumlah_pelanggaran ?? hasil?.jumlah_pelanggaran ?? 0);
      // Jika status didiskualifikasi, pelanggaran tidak boleh 0x
      if (status === 'didiskualifikasi' && pelanggaranCount === 0) {
        pelanggaranCount = logs.length > 0 ? logs.length : (Number(exam.max_pelanggaran) || 3);
      } else if (logs.length > pelanggaranCount) {
        pelanggaranCount = logs.length;
      }

      return {
        murid_id: m.murid_id,
        nama_murid: m.nama_murid,
        nis: m.nis,
        jenis_kelamin: m.jenis_kelamin,
        status, // 'belum_masuk' | 'sedang_mengerjakan' | 'terputus' | 'selesai' | 'didiskualifikasi'
        is_live_online: isLiveOnline,
        total_soal: totalSoal,
        jumlah_terjawab: terjawab,
        jumlah_belum: belum,
        jumlah_ragu: ragu,
        jumlah_pelanggaran: pelanggaranCount,
        log_pelanggaran: logs,
        is_disqualified: status === 'didiskualifikasi',
        skor_akhir: hasil ? Number(hasil.skor_akhir) : null,
        jumlah_benar: hasil ? Number(hasil.jumlah_benar) : null,
        jumlah_salah: hasil ? Number(hasil.jumlah_salah) : null,
        waktu_masuk: live?.waktu_masuk || hasil?.waktu_mulai || null,
        last_heartbeat: live?.last_heartbeat || hasil?.waktu_selesai || null,
        seconds_ago: live?.seconds_since_heartbeat ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        judul: exam.judul,
        mata_pelajaran: exam.mata_pelajaran,
        nama_kelas: exam.nama_kelas || 'Seluruh Kelas',
        total_soal: totalSoalExam,
        durasi_menit: exam.durasi_menit,
        passing_grade: exam.passing_grade,
        anti_curang: exam.anti_curang,
        max_pelanggaran: exam.max_pelanggaran || 3,
        token_ujian: exam.token_ujian,
        status_sesi: exam.status_sesi,
      },
      summary: {
        total_peserta: muridList.length,
        sedang_mengerjakan: countSedang,
        belum_masuk: countBelum,
        selesai: countSelesai,
        didiskualifikasi: countDiskualifikasi,
      },
      participants,
    });
  } catch (error: any) {
    console.error('Error in GET /api/ujian/live-proctor:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const body = await request.json();
    const { action, ujian_id } = body;

    if (!ujian_id) {
      return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });
    }

    // Ambil IP & user agent
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null;
    const deviceInfo = (request.headers.get('user-agent') || '').slice(0, 250);

    // =========================================================================
    // AKSI 1: HEARTBEAT / PROGRESS SYNC REAL-TIME DARI SANTRI
    // =========================================================================
    if (action === 'heartbeat' || action === 'join' || action === 'violation') {
      let targetMuridId = payload.muridId;
      if (!targetMuridId && (payload.role === 'admin' || payload.role === 'staff')) {
        targetMuridId = body.murid_id || 1;
      }
      if (!targetMuridId) {
        return NextResponse.json({ error: 'Akun tidak terikat data santri.' }, { status: 400 });
      }

      const {
        jumlah_terjawab = 0,
        jumlah_ragu = 0,
        total_soal = 0,
        jumlah_pelanggaran = 0,
        is_disqualified = false,
        log_pelanggaran = [],
      } = body;

      const statusPengerjaan = is_disqualified ? 'didiskualifikasi' : 'sedang_mengerjakan';

      await pool.execute(
        `INSERT INTO ujian_live_proctor 
          (ujian_id, murid_id, status_pengerjaan, jumlah_terjawab, jumlah_ragu, total_soal,
           jumlah_pelanggaran, is_disqualified, log_pelanggaran, device_info, ip_address, waktu_masuk, last_heartbeat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           status_pengerjaan = VALUES(status_pengerjaan),
           jumlah_terjawab = VALUES(jumlah_terjawab),
           jumlah_ragu = VALUES(jumlah_ragu),
           total_soal = VALUES(total_soal),
           jumlah_pelanggaran = VALUES(jumlah_pelanggaran),
           is_disqualified = VALUES(is_disqualified),
           log_pelanggaran = VALUES(log_pelanggaran),
           device_info = VALUES(device_info),
           ip_address = VALUES(ip_address),
           last_heartbeat = NOW()`,
        [
          ujian_id,
          targetMuridId,
          statusPengerjaan,
          Number(jumlah_terjawab) || 0,
          Number(jumlah_ragu) || 0,
          Number(total_soal) || 0,
          Number(jumlah_pelanggaran) || 0,
          is_disqualified ? 1 : 0,
          JSON.stringify(log_pelanggaran || []),
          deviceInfo,
          ipAddress,
        ]
      );

      return NextResponse.json({ success: true, timestamp: Date.now() });
    }

    // =========================================================================
    // AKSI 2: PENGATURAN PENGAWAS — RESET SESI SANTRI (DISPENSASI / KENDALA TEKNIS)
    // =========================================================================
    if (action === 'reset_santri') {
      const { role } = payload;
      if (role !== 'admin' && role !== 'staff' && role !== 'guru') {
        return NextResponse.json({ error: 'Hanya dewan pengawas atau guru yang dapat mereset sesi santri.' }, { status: 403 });
      }

      const { target_murid_id } = body;
      if (!target_murid_id) {
        return NextResponse.json({ error: 'target_murid_id diperlukan.' }, { status: 400 });
      }

      // Hapus dari sesi live proctor & riwayat hasil jika ada
      await pool.execute('DELETE FROM ujian_live_proctor WHERE ujian_id = ? AND murid_id = ?', [ujian_id, target_murid_id]);
      await pool.execute('DELETE FROM ujian_hasil_santri WHERE ujian_id = ? AND murid_id = ?', [ujian_id, target_murid_id]);
      await pool.execute('DELETE FROM ujian_essay_jawaban WHERE ujian_id = ? AND murid_id = ?', [ujian_id, target_murid_id]);

      return NextResponse.json({
        success: true,
        message: 'Sesi ujian santri berhasil direset. Santri kini dapat masuk kembali ke ruang ujian.',
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/ujian/live-proctor:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
