import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

function cleanString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// GET: Ambil daftar kuis dari bridge QuizB di Rumahweb + riwayat sync terakhir
export async function GET(request: Request) {
  try {
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId } = payload;
    const roleLower = (role || '').toLowerCase();

    // Ambil daftar mapel yang diizinkan user berdasarkan RBAC dari jadwal_madin & jadwal_quran
    let allowedMapel: string[] = [];
    try {
      if (roleLower === 'guru' && guruId) {
        const [mapelRows] = await pool.execute<RowDataPacket[]>(
          'SELECT DISTINCT mata_pelajaran FROM jadwal_madin WHERE guru_id = ? AND mata_pelajaran IS NOT NULL AND mata_pelajaran != ""',
          [guruId]
        );
        allowedMapel = (mapelRows as any[]).map((r: any) => (r.mata_pelajaran || '').toLowerCase().trim()).filter(Boolean);
      } else {
        // Untuk admin / staff / role lain: ambil seluruh mapel yang ada di PPMAWAR (bukan semua kuis dari QuizB)
        const [allMadin] = await pool.execute<RowDataPacket[]>(
          'SELECT DISTINCT mata_pelajaran FROM jadwal_madin WHERE mata_pelajaran IS NOT NULL AND mata_pelajaran != ""'
        );
        const [allQuran] = await pool.execute<RowDataPacket[]>(
          'SELECT DISTINCT mata_pelajaran FROM jadwal_quran WHERE mata_pelajaran IS NOT NULL AND mata_pelajaran != ""'
        );
        const combined = new Set<string>();
        (allMadin as any[]).forEach((r: any) => { if (r.mata_pelajaran) combined.add(r.mata_pelajaran.toLowerCase().trim()); });
        (allQuran as any[]).forEach((r: any) => { if (r.mata_pelajaran) combined.add(r.mata_pelajaran.toLowerCase().trim()); });
        allowedMapel = Array.from(combined);
      }
    } catch (e) {
      // ignore, biarkan tanpa filter jika query gagal
    }

    // Ambil setting bridge
    let bridgeUrl = 'https://quizb.my.id/quizb_bridge.php';
    let secretKey = 'ppmawar-quizb-2026-secret';

    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT setting_key, setting_value FROM quizb_settings WHERE setting_key IN ('bridge_url', 'secret_key')"
      );
      rows.forEach((r: any) => {
        if (r.setting_key === 'bridge_url' && r.setting_value) bridgeUrl = r.setting_value;
        if (r.setting_key === 'secret_key' && r.setting_value) secretKey = r.setting_value;
      });
    } catch (e) {
      // ignore
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const quizId = searchParams.get('quiz_id');
    const searchQ = searchParams.get('q') || '';

    // HANDLER KHUSUS: AMBIL DAFTAR BUTIR SOAL DARI QUIZB / UJIAN CBT
    if (action === 'get_questions') {
      if (!quizId) {
        return NextResponse.json({ error: 'Parameter quiz_id diperlukan' }, { status: 400 });
      }

      // Jika dari ujian CBT internal PPMAWAR (prefix cbt_)
      if (String(quizId).startsWith('cbt_')) {
        const cbtId = Number(quizId.replace('cbt_', ''));
        let qSql = 'SELECT * FROM ujian_soal WHERE ujian_id = ?';
        const qParams: any[] = [cbtId];
        if (searchQ) {
          qSql += ' AND pertanyaan LIKE ?';
          qParams.push(`%${searchQ}%`);
        }
        qSql += ' ORDER BY nomor_urut ASC, id ASC';
        const [rows] = await pool.execute<RowDataPacket[]>(qSql, qParams);
        return NextResponse.json({
          success: true,
          quiz_id: quizId,
          total_questions: rows.length,
          questions: rows,
          is_internal: true,
        });
      }

      // Jika dari QuizB di Rumahweb
      try {
        const targetUrl = new URL(bridgeUrl);
        targetUrl.searchParams.set('action', 'get_questions');
        targetUrl.searchParams.set('quiz_id', String(quizId));
        if (searchQ) targetUrl.searchParams.set('q', searchQ);
        targetUrl.searchParams.set('secret', secretKey);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const resp = await fetch(targetUrl.toString(), {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'error') {
            const isUnknownAction = (data.message || '').includes('tidak dikenal') || (data.message || '').includes('get_questions');
            return NextResponse.json({
              success: false,
              error: isUnknownAction
                ? 'File quizb_bridge.php di cPanel hosting quizb.my.id belum diperbarui dengan versi terbaru. Harap salin file public/quizb_bridge.php ke cPanel quizb.my.id.'
                : (data.message || 'Gagal memuat butir soal dari QuizB.'),
              questions: [],
              needs_bridge_update: isUnknownAction,
            });
          }
          return NextResponse.json({
            success: true,
            quiz_id: quizId,
            total_questions: data.total_questions || (data.questions ? data.questions.length : 0),
            questions: data.questions || [],
            message: data.message || '',
          });
        } else {
          let errDetail = `HTTP ${resp.status}`;
          let isUnknownAction = false;
          try {
            const errData = await resp.json();
            if (errData.message) {
              errDetail = errData.message;
              if (errData.message.includes('tidak dikenal') || errData.message.includes('get_questions')) {
                isUnknownAction = true;
              }
            }
          } catch {}
          return NextResponse.json({
            success: false,
            error: isUnknownAction
              ? 'File quizb_bridge.php di cPanel hosting quizb.my.id belum diperbarui dengan versi terbaru. Harap salin file public/quizb_bridge.php ke cPanel quizb.my.id.'
              : `QuizB Bridge merespon: ${errDetail}`,
            questions: [],
            needs_bridge_update: isUnknownAction,
          }, { status: resp.status });
        }
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          error: `Gagal mengambil butir soal dari QuizB: ${err.message}`,
          questions: [],
        }, { status: 500 });
      }
    }

    // Ambil riwayat sync terakhir
    let recentLogs: any[] = [];
    try {
      const [logs] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM quizb_sync_logs ORDER BY created_at DESC LIMIT 10'
      );
      recentLogs = logs;
    } catch (e) {
      // ignore
    }

    // Coba kontak Bridge QuizB di Rumahweb
    let quizzes: any[] = [];
    let bridgeConnected = false;
    let bridgeMessage = '';

    // Ambil juga daftar paket Ujian CBT internal PPMAWAR yang sudah dibuat
    let cbtExams: any[] = [];
    try {
      let cbtSql = `
        SELECT 
          u.id, 
          u.judul, 
          u.mata_pelajaran, 
          u.quizb_id, 
          u.jenis_ujian,
          COUNT(h.id) as total_peserta
        FROM ujian_madin u
        LEFT JOIN ujian_hasil_santri h ON u.id = h.ujian_id
      `;
      const cbtParams: any[] = [];
      if (roleLower === 'guru' && guruId) {
        cbtSql += ' WHERE u.guru_id = ?';
        cbtParams.push(guruId);
      }
      cbtSql += ' GROUP BY u.id ORDER BY total_peserta DESC, u.id DESC LIMIT 50';

      const [cbtRows] = await pool.execute<RowDataPacket[]>(cbtSql, cbtParams);
      cbtExams = (cbtRows as any[]).map((row: any) => {
        const pesertaCount = Number(row.total_peserta || 0);
        return {
          id: `cbt_${row.id}`,
          cbt_id: row.id,
          title: `[CBT PPMAWAR] ${row.judul} (${pesertaCount > 0 ? `✅ ${pesertaCount} Santri Sudah Ujian` : 'Belum Ada Santri / 0 Peserta'})`,
          category: row.mata_pelajaran || '',
          total_peserta: pesertaCount,
          quizb_id: row.quizb_id || '',
          is_internal_cbt: true,
        };
      });
    } catch (cbtErr) {
      console.warn('Gagal ambil data ujian CBT internal:', cbtErr);
    }

    try {
      const targetUrl = new URL(bridgeUrl);
      targetUrl.searchParams.set('action', 'list_quizzes');
      targetUrl.searchParams.set('secret', secretKey);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 detik timeout

      const resp = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && (Array.isArray(data) || Array.isArray(data.quizzes))) {
          const remoteQuizzes = Array.isArray(data) ? data : data.quizzes;
          quizzes = [...cbtExams, ...remoteQuizzes];
          bridgeConnected = true;
          bridgeMessage = 'Terhubung dengan QuizB di Rumahweb.';
        } else if (data && data.error) {
          quizzes = cbtExams;
          bridgeMessage = `QuizB Bridge merespon error: ${data.error}`;
        }
      } else {
        quizzes = cbtExams;
        bridgeMessage = `QuizB Bridge mengembalikan HTTP status ${resp.status}`;
      }
    } catch (fetchErr: any) {
      quizzes = cbtExams;
      bridgeMessage = fetchErr.name === 'AbortError' 
        ? 'Koneksi ke QuizB timeout (lebih dari 6 detik).' 
        : `Belum dapat terhubung ke ${bridgeUrl} (${fetchErr.message}). File bridge belum di-upload ke cPanel Rumahweb atau URL belum sesuai.`;
    }

    return NextResponse.json({
      success: true,
      bridge_connected: bridgeConnected,
      bridge_message: bridgeMessage,
      bridge_url: bridgeUrl,
      quizzes,
      allowed_mapel: allowedMapel,
      recent_logs: recentLogs,
    });
  } catch (error: any) {
    console.error('Error in GET /api/quizb/fetch:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Ambil hasil kuis spesifik & cocokkan dengan santri PPMAWAR
export async function POST(request: Request) {
  try {
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const body = await request.json();
    const {
      quiz_id,
      quiz_title,
      scores_raw = [], // Bila pengguna mem-paste langsung JSON/CSV hasil quiz
      kelas_id,
    } = body;

    let incomingScores = scores_raw;
    let matchedExamIds: number[] = [];
    const cleanQuizIdStr = quiz_id ? String(quiz_id).trim() : '';

    // Jika scores_raw kosong tetapi quiz_id diberikan:
    // 1. Cek dulu apakah quiz_id adalah Ujian CBT Internal PPMAWAR (cbt_X) atau id / quizb_id yang ditautkan di ujian_madin
    if ((!incomingScores || incomingScores.length === 0) && quiz_id) {
      if (cleanQuizIdStr.startsWith('cbt_')) {
        const parsedId = parseInt(cleanQuizIdStr.replace('cbt_', ''), 10);
        if (!isNaN(parsedId)) matchedExamIds.push(parsedId);
      } else {
        try {
          const [matchedExams] = await pool.execute<RowDataPacket[]>(
            'SELECT id FROM ujian_madin WHERE id = ? OR quizb_id = ?',
            [cleanQuizIdStr, cleanQuizIdStr]
          );
          (matchedExams as any[]).forEach((e: any) => {
            if (e.id) matchedExamIds.push(e.id);
          });
        } catch (e) {
          // ignore
        }
      }

      // Jika ada ujian CBT internal yang cocok, ambil hasilnya langsung dari ujian_hasil_santri
      if (matchedExamIds.length > 0) {
        try {
          const placeholders = matchedExamIds.map(() => '?').join(',');
          const [cbtScores] = await pool.execute<RowDataPacket[]>(
            `SELECT 
               h.murid_id, 
               h.skor_akhir as skor, 
               m.nama, 
               m.nis
             FROM ujian_hasil_santri h
             JOIN murid m ON h.murid_id = m.murid_id
             WHERE h.ujian_id IN (${placeholders})`,
            matchedExamIds
          );

          if ((cbtScores as any[]).length > 0) {
            incomingScores = cbtScores;
          }
        } catch (dbErr) {
          console.warn('Gagal ambil skor dari ujian_hasil_santri:', dbErr);
        }
      }

      // 2. Jika di internal CBT tidak ada, baru fetch dari Bridge di Rumahweb
      if (!incomingScores || incomingScores.length === 0) {
        let bridgeUrl = 'https://quizb.my.id/quizb_bridge.php';
        let secretKey = 'ppmawar-quizb-2026-secret';

        const [rows] = await pool.execute<RowDataPacket[]>(
          "SELECT setting_key, setting_value FROM quizb_settings WHERE setting_key IN ('bridge_url', 'secret_key')"
        );
        rows.forEach((r: any) => {
          if (r.setting_key === 'bridge_url' && r.setting_value) bridgeUrl = r.setting_value;
          if (r.setting_key === 'secret_key' && r.setting_value) secretKey = r.setting_value;
        });

        const targetUrl = new URL(bridgeUrl);
        targetUrl.searchParams.set('action', 'get_results');
        targetUrl.searchParams.set('quiz_id', String(quiz_id));
        targetUrl.searchParams.set('secret', secretKey);

        const resp = await fetch(targetUrl.toString(), {
          headers: { 'Accept': 'application/json' },
        });

        if (resp.ok) {
          const data = await resp.json();
          incomingScores = Array.isArray(data) ? data : (data.results || data.scores || []);
        }
      }
    }

    if (!Array.isArray(incomingScores) || incomingScores.length === 0) {
      const isCbtExam = cleanQuizIdStr.startsWith('cbt_') || matchedExamIds.length > 0;
      const errorMsg = isCbtExam
        ? `Paket ujian CBT ini (${quiz_title || cleanQuizIdStr}) belum memiliki santri yang menyelesaikan ujian (0 Peserta). Silakan pilih paket ujian CBT yang sudah dikerjakan santri.`
        : 'Tidak ada data peserta/nilai untuk kuis QuizB ini. Pastikan kuis ini sudah diimpor ke Portal Ujian Santri Digital dan dikerjakan oleh para santri di aplikasi CBT PPMAWAR.';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Ambil santri (bisa dibatasi berdasarkan kelas jika dipilih, atau semua)
    let sqlMurid = 'SELECT murid_id, nis, nama, kelas_madin_id FROM murid';
    const paramsMurid: any[] = [];
    if (kelas_id && kelas_id !== 'SEMUA' && kelas_id !== 'all') {
      sqlMurid += ' WHERE kelas_madin_id = ? OR kelas_madin_2_id = ?';
      paramsMurid.push(kelas_id, kelas_id);
    }

    const [muridRows] = await pool.execute<RowDataPacket[]>(sqlMurid, paramsMurid);

    const idMap = new Map<number, any>();
    const nisMap = new Map<string, any>();
    const exactNameMap = new Map<string, any>();
    const cleanNameMap = new Map<string, any>();

    for (const m of muridRows) {
      idMap.set(Number(m.murid_id), m);
      if (m.nis) nisMap.set(String(m.nis).trim(), m);
      if (m.nama) {
        exactNameMap.set(m.nama.trim().toLowerCase(), m);
        cleanNameMap.set(cleanString(m.nama), m);
      }
    }

    const previewMatched: any[] = [];
    const previewUnmatched: any[] = [];

    for (const item of incomingScores) {
      const itemNis = item.nis ? String(item.nis).trim() : '';
      const itemNama = item.nama || item.name || item.student_name || item.username || '';
      const rawScore = item.skor !== undefined && item.skor !== null 
        ? Number(item.skor) 
        : Number(item.nilai || item.score || item.point || 0);
      const scoreVal = Math.min(Math.max(isNaN(rawScore) ? 0 : rawScore, 0), 100);

      let foundMurid: any = null;
      let matchMethod = '';

      // 1. Cek langsung dari ID Santri jika ada (CBT internal PPMAWAR)
      if (item.murid_id && idMap.has(Number(item.murid_id))) {
        foundMurid = idMap.get(Number(item.murid_id));
        matchMethod = 'ID Santri CBT';
      }

      // 2. Cek berdasarkan NIS
      if (!foundMurid && itemNis && nisMap.has(itemNis)) {
        foundMurid = nisMap.get(itemNis);
        matchMethod = 'NIS';
      }

      if (!foundMurid && itemNama && exactNameMap.has(itemNama.toLowerCase())) {
        foundMurid = exactNameMap.get(itemNama.toLowerCase());
        matchMethod = 'Nama Persis';
      }

      if (!foundMurid && itemNama && cleanNameMap.has(cleanString(itemNama))) {
        foundMurid = cleanNameMap.get(cleanString(itemNama));
        matchMethod = 'Nama Bersih';
      }

      if (!foundMurid && itemNama) {
        const cleanItem = cleanString(itemNama);
        if (cleanItem.length >= 4) {
          for (const m of muridRows) {
            const cleanM = cleanString(m.nama);
            if (cleanM.includes(cleanItem) || cleanItem.includes(cleanM)) {
              foundMurid = m;
              matchMethod = 'Nama Mirip';
              break;
            }
          }
        }
      }

      if (foundMurid) {
        previewMatched.push({
          murid_id: foundMurid.murid_id,
          nama: foundMurid.nama,
          nis: foundMurid.nis,
          skor: scoreVal,
          quizb_nama: itemNama,
          match_method: matchMethod,
        });
      } else {
        previewUnmatched.push({
          quizb_nama: itemNama,
          quizb_nis: itemNis,
          skor: scoreVal,
        });
      }
    }

    return NextResponse.json({
      success: true,
      quiz_id,
      quiz_title,
      total_items: incomingScores.length,
      matched_count: previewMatched.length,
      unmatched_count: previewUnmatched.length,
      matched: previewMatched,
      unmatched: previewUnmatched,
    });
  } catch (error: any) {
    console.error('Error in POST /api/quizb/fetch:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
