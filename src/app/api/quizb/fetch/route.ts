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
          quizzes = Array.isArray(data) ? data : data.quizzes;
          bridgeConnected = true;
          bridgeMessage = 'Terhubung dengan QuizB di Rumahweb.';
        } else if (data && data.error) {
          bridgeMessage = `QuizB Bridge merespon error: ${data.error}`;
        }
      } else {
        bridgeMessage = `QuizB Bridge mengembalikan HTTP status ${resp.status}`;
      }
    } catch (fetchErr: any) {
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

    // Jika scores_raw kosong tetapi quiz_id diberikan, coba fetch dari Bridge di Rumahweb
    if ((!incomingScores || incomingScores.length === 0) && quiz_id) {
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

      if (!resp.ok) {
        return NextResponse.json({ error: `Gagal mengambil data dari QuizB (HTTP ${resp.status})` }, { status: 400 });
      }

      const data = await resp.json();
      incomingScores = Array.isArray(data) ? data : (data.results || data.scores || []);
    }

    if (!Array.isArray(incomingScores) || incomingScores.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data peserta/nilai yang ditemukan untuk kuis ini.' }, { status: 400 });
    }

    // Ambil santri (bisa dibatasi berdasarkan kelas jika dipilih, atau semua)
    let sqlMurid = 'SELECT murid_id, nis, nama, kelas_madin_id FROM murid';
    const paramsMurid: any[] = [];
    if (kelas_id && kelas_id !== 'SEMUA' && kelas_id !== 'all') {
      sqlMurid += ' WHERE kelas_madin_id = ? OR kelas_madin_2_id = ?';
      paramsMurid.push(kelas_id, kelas_id);
    }

    const [muridRows] = await pool.execute<RowDataPacket[]>(sqlMurid, paramsMurid);

    const nisMap = new Map<string, any>();
    const exactNameMap = new Map<string, any>();
    const cleanNameMap = new Map<string, any>();

    for (const m of muridRows) {
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

      if (itemNis && nisMap.has(itemNis)) {
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
