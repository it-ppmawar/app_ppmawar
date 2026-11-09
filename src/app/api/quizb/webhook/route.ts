import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

function calcPredikat(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score > 0) return 'E';
  return '-';
}

function cleanString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export async function POST(request: Request) {
  try {
    await ensurePenilaianDB();

    const { searchParams } = new URL(request.url);
    const headerSecret = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '') || searchParams.get('secret');

    // Ambil secret_key dari database quizb_settings atau default .env
    let validSecret = process.env.QUIZB_WEBHOOK_SECRET || 'ppmawar-quizb-2026-secret';
    try {
      const [settingRows] = await pool.execute<RowDataPacket[]>(
        "SELECT setting_value FROM quizb_settings WHERE setting_key = 'secret_key' LIMIT 1"
      );
      if (settingRows.length > 0 && settingRows[0].setting_value) {
        validSecret = settingRows[0].setting_value;
      }
    } catch (e) {
      // ignore
    }

    if (!headerSecret || headerSecret.trim() !== validSecret.trim()) {
      return NextResponse.json({ error: 'Akses Ditolak: Secret Key / API Key QuizB tidak valid.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      quiz_id,
      quiz_title,
      semester = '1',
      tahun_ajaran = '2025/2026',
      source = 'webhook',
    } = body;

    const target_field = body.target_field || body.jenis_ujian || 'harian';
    const mata_pelajaran = body.mata_pelajaran || quiz_title || 'Ujian Online';

    let scores = Array.isArray(body.scores) ? body.scores : [];

    // Dukung format single object: { nis, nama, skor, ... }
    if (scores.length === 0 && (body.nis || body.nama || body.skor !== undefined || body.nilai !== undefined)) {
      scores = [
        {
          nis: body.nis,
          nama: body.nama,
          skor: body.skor !== undefined ? body.skor : body.nilai,
        },
      ];
    }

    if (scores.length === 0) {
      return NextResponse.json({ error: 'Daftar nilai (scores) kosong atau tidak valid.' }, { status: 400 });
    }

    // Ambil seluruh santri dari database untuk pencocokan pintar (NIS & Nama)
    const [allMurid] = await pool.execute<RowDataPacket[]>(
      'SELECT murid_id, nis, nama, kelas_madin_id FROM murid'
    );

    // Buat lookup maps
    const nisMap = new Map<string, any>();
    const exactNameMap = new Map<string, any>();
    const cleanNameMap = new Map<string, any>();

    for (const m of allMurid) {
      if (m.nis) {
        nisMap.set(String(m.nis).trim(), m);
      }
      if (m.nama) {
        exactNameMap.set(m.nama.trim().toLowerCase(), m);
        cleanNameMap.set(cleanString(m.nama), m);
      }
    }

    const matchedList: any[] = [];
    const unmatchedList: any[] = [];

    for (const item of scores) {
      const itemNis = item.nis ? String(item.nis).trim() : '';
      const itemNama = item.nama ? String(item.nama).trim() : '';
      const rawScore = item.skor !== undefined && item.skor !== null ? Number(item.skor) : Number(item.nilai || 0);
      const scoreVal = Math.min(Math.max(isNaN(rawScore) ? 0 : rawScore, 0), 100);

      let foundMurid: any = null;
      let matchMethod = '';

      // 1. Coba cocokkan via NIS
      if (itemNis && nisMap.has(itemNis)) {
        foundMurid = nisMap.get(itemNis);
        matchMethod = 'nis';
      }

      // 2. Jika tidak cocok, coba nama persis
      if (!foundMurid && itemNama && exactNameMap.has(itemNama.toLowerCase())) {
        foundMurid = exactNameMap.get(itemNama.toLowerCase());
        matchMethod = 'nama_exact';
      }

      // 3. Jika belum cocok, coba nama bersih (hapus spasi & tanda baca)
      if (!foundMurid && itemNama && cleanNameMap.has(cleanString(itemNama))) {
        foundMurid = cleanNameMap.get(cleanString(itemNama));
        matchMethod = 'nama_clean';
      }

      // 4. Jika belum cocok, coba fuzzy substring (jika nama di QuizB adalah nama panggilan atau substring nama lengkap)
      if (!foundMurid && itemNama) {
        const cleanItem = cleanString(itemNama);
        if (cleanItem.length >= 4) {
          for (const m of allMurid) {
            const cleanM = cleanString(m.nama);
            if (cleanM.includes(cleanItem) || cleanItem.includes(cleanM)) {
              foundMurid = m;
              matchMethod = 'nama_fuzzy';
              break;
            }
          }
        }
      }

      if (foundMurid) {
        matchedList.push({
          murid_id: foundMurid.murid_id,
          nama: foundMurid.nama,
          nis: foundMurid.nis,
          skor: scoreVal,
          matchMethod,
          itemNama,
        });

        // Ambil nilai eksisting bila ada
        const [existingRows] = await pool.execute<RowDataPacket[]>(
          `SELECT id, nilai_harian, nilai_uts, nilai_uas, catatan 
           FROM nilai_santri 
           WHERE murid_id = ? AND mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ? 
           LIMIT 1`,
          [foundMurid.murid_id, mata_pelajaran, semester, tahun_ajaran]
        );

        let harian = 0;
        let uts = 0;
        let uas = 0;
        let catatan = `QuizB: ${quiz_title || 'Kuis Online'} (${scoreVal})`;

        if (existingRows.length > 0) {
          const ex = existingRows[0];
          harian = ex.nilai_harian !== null ? Number(ex.nilai_harian) : 0;
          uts = ex.nilai_uts !== null ? Number(ex.nilai_uts) : 0;
          uas = ex.nilai_uas !== null ? Number(ex.nilai_uas) : 0;
          if (ex.catatan) {
            catatan = `${ex.catatan}; ${catatan}`;
          }
        }

        // Terapkan skor ke target field yang dipilih
        if (target_field === 'uts') {
          uts = scoreVal;
        } else if (target_field === 'uas') {
          uas = scoreVal;
        } else {
          // Default ke harian
          harian = scoreVal;
        }

        const nilaiAkhir = Math.round((harian * 0.3 + uts * 0.3 + uas * 0.4) * 100) / 100;
        const predikat = calcPredikat(nilaiAkhir);

        // Upsert nilai_santri
        await pool.execute(
          `INSERT INTO nilai_santri 
            (murid_id, kelas_madin_id, mata_pelajaran, semester, tahun_ajaran, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             kelas_madin_id = VALUES(kelas_madin_id),
             nilai_harian = VALUES(nilai_harian),
             nilai_uts = VALUES(nilai_uts),
             nilai_uas = VALUES(nilai_uas),
             nilai_akhir = VALUES(nilai_akhir),
             predikat = VALUES(predikat),
             catatan = VALUES(catatan),
             updated_at = CURRENT_TIMESTAMP`,
          [
            foundMurid.murid_id,
            foundMurid.kelas_madin_id || null,
            mata_pelajaran,
            semester,
            tahun_ajaran,
            harian,
            uts,
            uas,
            nilaiAkhir,
            predikat,
            catatan,
          ]
        );
      } else {
        unmatchedList.push({
          itemNama,
          itemNis,
          skor: scoreVal,
        });
      }
    }

    // Catat log sinkronisasi
    try {
      await pool.execute(
        `INSERT INTO quizb_sync_logs 
          (quiz_id, quiz_title, target_field, mata_pelajaran, semester, tahun_ajaran, total_received, total_matched, source, detail_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quiz_id ? String(quiz_id) : null,
          quiz_title || 'QuizB Import',
          target_field,
          mata_pelajaran,
          semester,
          tahun_ajaran,
          scores.length,
          matchedList.length,
          source,
          JSON.stringify({
            matchedCount: matchedList.length,
            unmatchedCount: unmatchedList.length,
            unmatchedSample: unmatchedList.slice(0, 10),
          }),
        ]
      );
    } catch (logErr) {
      console.warn('Gagal mencatat quizb_sync_logs:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan nilai QuizB! ${matchedList.length} dari ${scores.length} santri berhasil dicocokkan dan disimpan ke Nilai ${target_field.toUpperCase()}.`,
      total_received: scores.length,
      total_matched: matchedList.length,
      total_unmatched: unmatchedList.length,
      unmatched_list: unmatchedList,
    });
  } catch (error: any) {
    console.error('Error in /api/quizb/webhook:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
