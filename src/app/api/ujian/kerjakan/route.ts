import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaPhi = (lat2 - lat1) * rad;
  const deltaLambda = (lon2 - lon1) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function calcPredikat(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score > 0) return 'E';
  return '-';
}

export async function POST(request: Request) {
  try {
    await ensureUjianDB();
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, muridId } = payload;
    // Ambil IP & device info dari header request
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null;
    const deviceInfo = request.headers.get('user-agent') || null;
    const body = await request.json();
    const { action = 'validate', ujian_id } = body;

    if (!ujian_id) {
      return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });
    }

    // Identifikasi murid yang mengerjakan
    let targetMuridId = muridId;
    if (!targetMuridId && (role === 'admin' || role === 'staff')) {
      targetMuridId = body.murid_id || 1; // Testing mode untuk admin
    }

    if (!targetMuridId) {
      return NextResponse.json({ error: 'Akun ini tidak terikat dengan data santri.' }, { status: 400 });
    }

    // Ambil data ujian & sesi
    const [ujianRows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*, 
              s.id as sesi_id,
              s.token_ujian,
              s.wajib_token,
              s.wajib_geofence,
              s.max_radius_meter,
              s.lat_target,
              s.lng_target,
              s.status_sesi
       FROM ujian_madin u
       LEFT JOIN ujian_sesi_pengawas s ON u.id = s.ujian_id
       WHERE u.id = ? LIMIT 1`,
      [ujian_id]
    );

    if (ujianRows.length === 0) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    const exam = ujianRows[0];

    // =========================================================================
    // AKSI 1: VALIDASI TOKEN & LOKASI GEOLOKASI (SEBELUM MULAI UJIAN)
    // =========================================================================
    if (action === 'validate') {
      // 1. Cek apakah ujian aktif
      if (!exam.is_active) {
        return NextResponse.json({ error: 'Ujian ini sedang dinonaktifkan oleh pengajar.' }, { status: 403 });
      }

      // 2. Cek status sesi pengawas
      if (exam.status_sesi === 'tertutup') {
        return NextResponse.json({
          error: 'Sesi ujian ini sedang DITUTUP oleh pengawas. Silakan tunggu pengawas membuka sesi di kelas.',
        }, { status: 403 });
      }

      // 3. Cek apakah santri sudah pernah menyelesaikan ujian ini
      const [existingAttempts] = await pool.execute<RowDataPacket[]>(
        'SELECT id, skor_akhir, waktu_selesai FROM ujian_hasil_santri WHERE ujian_id = ? AND murid_id = ? LIMIT 1',
        [ujian_id, targetMuridId]
      );
      if (existingAttempts.length > 0) {
        return NextResponse.json({
          error: 'Anda sudah menyelesaikan ujian ini. Nilai Anda: ' + existingAttempts[0].skor_akhir,
          already_completed: true,
          hasil: existingAttempts[0],
        }, { status: 400 });
      }

      // 4. Validasi Token Ujian dari Pengawas di Kelas
      if (exam.wajib_token) {
        const inputToken = (body.token_input || '').toString().trim().toUpperCase();
        const validToken = (exam.token_ujian || '').toString().trim().toUpperCase();
        if (!inputToken || inputToken !== validToken) {
          return NextResponse.json({
            error: 'Token ujian salah. Mintalah token sesi ujian resmi kepada pengawas di ruang kelas Anda.',
          }, { status: 400 });
        }
      }

      // 5. Validasi Geofence Radius Pesantren (Anti Joki / Pengerjaan di Luar Kelas)
      let distanceMeters: number | null = null;
      if (exam.wajib_geofence) {
        const userLat = parseFloat(body.user_lat);
        const userLng = parseFloat(body.user_lng);

        // Ambil target koordinat (dari sesi atau dari pengaturan pesantren)
        let centerLat = exam.lat_target ? parseFloat(exam.lat_target) : null;
        let centerLng = exam.lng_target ? parseFloat(exam.lng_target) : null;
        let allowedRadius = exam.max_radius_meter ? Number(exam.max_radius_meter) : 200;

        if (!centerLat || !centerLng) {
          try {
            const [settings] = await pool.execute<RowDataPacket[]>(
              "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('lat_pesantren', 'lng_pesantren', 'radius_absen')"
            );
            settings.forEach((r: any) => {
              if (r.nama_pengaturan === 'lat_pesantren') centerLat = parseFloat(r.nilai);
              if (r.nama_pengaturan === 'lng_pesantren') centerLng = parseFloat(r.nilai);
              if (r.nama_pengaturan === 'radius_absen' && !exam.max_radius_meter) allowedRadius = parseFloat(r.nilai);
            });
          } catch (e) {
            // ignore
          }
        }

        if (centerLat && centerLng && !isNaN(centerLat) && !isNaN(centerLng)) {
          if (isNaN(userLat) || isNaN(userLng)) {
            return NextResponse.json({
              error: 'Lokasi GPS (Geolokasi) pada perangkat Anda wajib diaktifkan untuk memastikan ujian dikerjakan di dalam area pengawas atau madrasah.',
            }, { status: 400 });
          }

          distanceMeters = calculateDistanceMeters(userLat, userLng, centerLat, centerLng);

          if (distanceMeters > allowedRadius) {
            const isPengawasLoc = !!exam.lat_target && !!exam.lng_target;
            const pesanTolak = isPengawasLoc
              ? `Akses Ditolak: Perangkat Anda terdeteksi berjarak ${distanceMeters} meter dari pengawas di ruang ujian (Batas maksimal ${allowedRadius} meter). Ujian wajib dikerjakan di dalam ruang kelas bersama pengawas.`
              : `Akses Ditolak: Perangkat Anda terdeteksi berada ${distanceMeters} meter dari area pesantren (Maksimal radius ${allowedRadius} meter). Ujian resmi hanya boleh dikerjakan di area madrasah/pesantren di bawah pengawasan asatidz.`;

            return NextResponse.json({
              error: pesanTolak,
              distance: distanceMeters,
              allowedRadius,
              is_pengawas_target: isPengawasLoc,
            }, { status: 403 });
          }
        }
      }

      // 6. Ambil Soal Ujian (Sembunyikan kunci jawaban & rubrik AI dari santri)
      let querySoal = `SELECT id, tipe_soal, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, bobot_nilai 
                       FROM ujian_soal WHERE ujian_id = ?`;
      if (exam.acak_soal) {
        querySoal += ' ORDER BY RAND()';
      } else {
        querySoal += ' ORDER BY nomor_urut ASC, id ASC';
      }

      const [soalRows] = await pool.execute<RowDataPacket[]>(querySoal, [ujian_id]);

      if (soalRows.length === 0) {
        return NextResponse.json({ error: 'Belum ada soal pada ujian ini.' }, { status: 400 });
      }

      // Catat bahwa santri mulai masuk ke ruang ujian live
      await pool.execute(
        `INSERT INTO ujian_live_proctor 
          (ujian_id, murid_id, status_pengerjaan, jumlah_terjawab, jumlah_ragu, total_soal,
           jumlah_pelanggaran, is_disqualified, device_info, ip_address, waktu_masuk, last_heartbeat)
         VALUES (?, ?, 'sedang_mengerjakan', 0, 0, ?, 0, 0, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           status_pengerjaan = IF(is_disqualified = 1, 'didiskualifikasi', 'sedang_mengerjakan'),
           last_heartbeat = NOW(),
           total_soal = VALUES(total_soal)`,
        [
          ujian_id,
          targetMuridId,
          soalRows.length,
          deviceInfo ? deviceInfo.slice(0, 250) : null,
          ipAddress,
        ]
      ).catch(() => {});

      return NextResponse.json({
        success: true,
        message: 'Validasi berhasil! Selamat mengerjakan ujian.',
        exam: {
          id: exam.id,
          judul: exam.judul,
          mata_pelajaran: exam.mata_pelajaran,
          durasi_menit: exam.durasi_menit,
          passing_grade: exam.passing_grade,
          anti_curang: exam.anti_curang !== undefined ? Number(exam.anti_curang) : 1,
          max_pelanggaran: exam.max_pelanggaran !== undefined ? Number(exam.max_pelanggaran) : 3,
          wajib_fullscreen: exam.wajib_fullscreen !== undefined ? Number(exam.wajib_fullscreen) : 1,
          total_soal: soalRows.length,
        },
        soal: soalRows,
        sesi_id: exam.sesi_id,
        distance_meter: distanceMeters,
      });
    }

    // =========================================================================
    // AKSI 2: SUBMIT JAWABAN UJIAN & SINKRONISASI RAPORT OTOMATIS
    // =========================================================================
    if (action === 'submit') {
      const {
        answers = {}, // Format: { [soal_id]: 'A' | 'B' | ... | text_essay }
        durasi_detik = 0,
        token_dipakai = '',
        user_lat = null,
        user_lng = null,
        jumlah_pelanggaran = 0,
        is_disqualified = false,
        log_pelanggaran = [],
      } = body;

      // Ambil seluruh butir soal dari database untuk evaluasi
      const [soalDB] = await pool.execute<RowDataPacket[]>(
        'SELECT id, tipe_soal, kunci_jawaban, bobot_nilai FROM ujian_soal WHERE ujian_id = ?',
        [ujian_id]
      );

      let totalPointsPossible = 0;
      let totalPointsEarnedPG = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let hasEssay = false;
      const essayList: any[] = [];

      for (const row of soalDB) {
        const qId = String(row.id);
        const bobot = Number(row.bobot_nilai) || 10;
        totalPointsPossible += bobot;
        const isEssay = row.tipe_soal === 'essay';

        if (isEssay) {
          hasEssay = true;
          const studentEssayAns = (answers[qId] || '').toString().trim();
          essayList.push({
            soal_id: row.id,
            jawaban: studentEssayAns,
            bobot,
          });
        } else {
          // Pilihan Ganda
          const studentAnswer = (answers[qId] || '').toString().trim().toUpperCase();
          const correctAnswer = (row.kunci_jawaban || '').toString().trim().toUpperCase();

          if (studentAnswer && studentAnswer === correctAnswer) {
            totalPointsEarnedPG += bobot;
            correctCount++;
          } else {
            wrongCount++;
          }
        }
      }

      // Hitung skor sementara / akhir
      let finalScore = 0;
      if (totalPointsPossible > 0) {
        finalScore = Math.round((totalPointsEarnedPG / totalPointsPossible) * 100 * 100) / 100;
      }

      // Jika didiskualifikasi karena melanggar aturan anti-pindah layar
      if (is_disqualified) {
        finalScore = 0;
      }

      const isPassed = !is_disqualified && finalScore >= Number(exam.passing_grade || 70);
      const statusKoreksi = hasEssay ? 'menunggu_koreksi' : 'selesai';

      // 1. Simpan riwayat ujian santri
      const [insertHasil] = await pool.execute<ResultSetHeader>(
        `INSERT INTO ujian_hasil_santri 
          (ujian_id, murid_id, sesi_id, token_dipakai, jawaban_json, total_soal, jumlah_benar, jumlah_salah, nilai_pg, nilai_essay, skor_akhir, status_lulus, status_koreksi, jumlah_pelanggaran, is_disqualified, log_pelanggaran, waktu_mulai, waktu_selesai, durasi_detik, lokasi_lat, lokasi_lng, ip_address, device_info)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? SECOND, NOW(), ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           jawaban_json = VALUES(jawaban_json),
           total_soal = VALUES(total_soal),
           jumlah_benar = VALUES(jumlah_benar),
           jumlah_salah = VALUES(jumlah_salah),
           nilai_pg = VALUES(nilai_pg),
           skor_akhir = VALUES(skor_akhir),
           status_lulus = VALUES(status_lulus),
           status_koreksi = VALUES(status_koreksi),
           jumlah_pelanggaran = VALUES(jumlah_pelanggaran),
           is_disqualified = VALUES(is_disqualified),
           log_pelanggaran = VALUES(log_pelanggaran),
           waktu_selesai = NOW(),
           durasi_detik = VALUES(durasi_detik),
           ip_address = VALUES(ip_address),
           device_info = VALUES(device_info),
           updated_at = CURRENT_TIMESTAMP`,
        [
          ujian_id,
          targetMuridId,
          exam.sesi_id || null,
          token_dipakai || null,
          JSON.stringify(answers),
          soalDB.length,
          correctCount,
          wrongCount,
          totalPointsEarnedPG,
          finalScore,
          isPassed ? 1 : 0,
          statusKoreksi,
          Number(jumlah_pelanggaran) || 0,
          is_disqualified ? 1 : 0,
          JSON.stringify(log_pelanggaran || []),
          Number(durasi_detik) || 60,
          Number(durasi_detik) || 60,
          user_lat || null,
          user_lng || null,
          ipAddress || null,
          deviceInfo ? deviceInfo.slice(0, 500) : null,
        ]
      );

      // 1b. Perbarui status di tabel live proctoring
      await pool.execute(
        `UPDATE ujian_live_proctor 
         SET status_pengerjaan = ?,
             jumlah_terjawab = ?,
             jumlah_pelanggaran = ?,
             is_disqualified = ?,
             log_pelanggaran = ?,
             waktu_selesai = NOW()
         WHERE ujian_id = ? AND murid_id = ?`,
        [
          is_disqualified ? 'didiskualifikasi' : 'selesai',
          Object.keys(answers).length,
          Number(jumlah_pelanggaran) || 0,
          is_disqualified ? 1 : 0,
          JSON.stringify(log_pelanggaran || []),
          ujian_id,
          targetMuridId,
        ]
      ).catch(() => {});

      // 2. Simpan setiap butir jawaban essay santri ke tabel ujian_essay_jawaban
      if (hasEssay && essayList.length > 0) {
        for (const e of essayList) {
          await pool.execute(
            `INSERT INTO ujian_essay_jawaban 
              (ujian_id, murid_id, soal_id, jawaban_santri, bobot_maksimal, status_koreksi)
             VALUES (?, ?, ?, ?, ?, 'belum')
             ON DUPLICATE KEY UPDATE
               jawaban_santri = VALUES(jawaban_santri),
               bobot_maksimal = VALUES(bobot_maksimal),
               updated_at = CURRENT_TIMESTAMP`,
            [ujian_id, targetMuridId, e.soal_id, e.jawaban, e.bobot]
          );
        }
      }

      // 3. SINKRONISASI OTOMATIS KE RAPORT (Jika ujian murni PG tanpa essay, dan tidak didiskualifikasi)
      if (!hasEssay && !is_disqualified) {
        try {
          const [existingNilai] = await pool.execute<RowDataPacket[]>(
            `SELECT id, nilai_harian, nilai_uts, nilai_uas, catatan 
             FROM nilai_santri 
             WHERE murid_id = ? AND mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ? 
             LIMIT 1`,
            [targetMuridId, exam.mata_pelajaran, exam.semester, exam.tahun_ajaran]
          );

          let harian = 0;
          let uts = 0;
          let uas = 0;
          let catatanBaru = `CBT: ${exam.judul} (${finalScore})`;

          if (existingNilai.length > 0) {
            const ex = existingNilai[0];
            harian = ex.nilai_harian !== null ? Number(ex.nilai_harian) : 0;
            uts = ex.nilai_uts !== null ? Number(ex.nilai_uts) : 0;
            uas = ex.nilai_uas !== null ? Number(ex.nilai_uas) : 0;
            if (ex.catatan) {
              catatanBaru = `${ex.catatan}; ${catatanBaru}`;
            }
          }

          // Terapkan ke komponen nilai yang sesuai
          if (exam.jenis_ujian === 'uts') {
            uts = finalScore;
          } else if (exam.jenis_ujian === 'uas') {
            uas = finalScore;
          } else {
            harian = finalScore;
          }

          const nilaiAkhir = Math.round((harian * 0.3 + uts * 0.3 + uas * 0.4) * 100) / 100;
          const predikat = calcPredikat(nilaiAkhir);

          await pool.execute(
            `INSERT INTO nilai_santri 
              (murid_id, kelas_madin_id, mata_pelajaran, kitab, semester, tahun_ajaran, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               kelas_madin_id = VALUES(kelas_madin_id),
               kitab = VALUES(kitab),
               nilai_harian = VALUES(nilai_harian),
               nilai_uts = VALUES(nilai_uts),
               nilai_uas = VALUES(nilai_uas),
               nilai_akhir = VALUES(nilai_akhir),
               predikat = VALUES(predikat),
               catatan = VALUES(catatan),
               updated_at = CURRENT_TIMESTAMP`,
            [
              targetMuridId,
              exam.kelas_madin_id || null,
              exam.mata_pelajaran,
              exam.kitab || null,
              exam.semester,
              exam.tahun_ajaran,
              harian,
              uts,
              uas,
              nilaiAkhir,
              predikat,
              catatanBaru,
            ]
          );
        } catch (syncErr: any) {
          console.error('Error auto-syncing CBT score to raport:', syncErr.message);
        }
      }

      return NextResponse.json({
        success: true,
        message: is_disqualified
          ? 'Ujian dihentikan otomatis karena terdeteksi keluar dari layar ujian berulang kali (Diskualifikasi).'
          : (hasEssay
            ? 'Ujian berhasil diselesaikan! Jawaban essay Anda telah tersimpan dan sedang menunggu koreksi oleh dewan pengajar / asisten AI.'
            : 'Ujian berhasil diselesaikan dan nilai telah otomatis disinkronkan ke buku nilai raport.'),
        hasil: {
          skor_akhir: finalScore,
          jumlah_benar: correctCount,
          jumlah_salah: wrongCount,
          total_soal: soalDB.length,
          status_lulus: isPassed ? 1 : 0,
          status_koreksi: statusKoreksi,
          has_essay: hasEssay,
          is_disqualified,
          jumlah_pelanggaran,
        },
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in POST /api/ujian/kerjakan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
