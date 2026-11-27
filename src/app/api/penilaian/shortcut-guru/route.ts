import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { createShortTokensBatch } from '@/lib/auth/shortToken';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';
import { resolveAsrama } from '@/lib/auth/resolveAsrama';
import { residualZeroConditionSql } from '@/lib/penilaian/nilaiSql';

export const dynamic = 'force-dynamic';

const noCacheHeaders = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: Request) {
  try {
    await ensurePenilaianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noCacheHeaders });
    }

    const payload = verifyToken(token) as any;
    if (!payload) {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401, headers: noCacheHeaders });
    }

    const role = String(payload.role || '').toLowerCase();
    if (!['admin', 'staff', 'guru'].includes(role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403, headers: noCacheHeaders });
    }

    const { searchParams } = new URL(request.url);
    const kategori = (searchParams.get('kategori') || 'all').toLowerCase(); // 'all' | 'putra' | 'putri'
    const kelasFilterId = searchParams.get('kelas_id') || 'all';
    const targetGuruId = searchParams.get('target_id');
    const semester = searchParams.get('semester') || '1';
    const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';
    const rawExpiry = searchParams.get('expiry') || '7';
    let days = parseInt(rawExpiry.replace(/[^0-9]/g, ''), 10);
    if (isNaN(days) || days < 1) days = 7;
    if (days > 90) days = 90;

    const expiryDuration = `${days}d`;
    const expiryDateObj = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const expDateFormatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(expiryDateObj);
    const durationLabel = `${days} Hari`;

    // RBAC & Filter Kondisi (dibagi menjadi scope dasar dan filter spesifik guru/kelas)
    const baseClauses: string[] = [
      'jm.mata_pelajaran IS NOT NULL',
      "TRIM(jm.mata_pelajaran) != ''"
    ];
    const baseParams: any[] = [];

    if (role === 'guru') {
      const ownGuruId = payload.guruId || payload.guru_id;
      if (ownGuruId) {
        baseClauses.push('g.guru_id = ?');
        baseParams.push(ownGuruId);
      } else {
        baseClauses.push('0 = 1');
      }
    } else if (role === 'staff') {
      const namaAsrama = await resolveAsrama(payload.userId, role, payload.username || '', payload.namaAsrama || null);
      const asr = (namaAsrama || payload.asrama || '').toLowerCase();
      const isPutra = asr === 'putra' || asr.includes('putra') || asr.includes('asrama a') || asr === 'a';
      const isPutri = asr === 'putri' || asr.includes('putri') || asr.includes('asrama b') || asr.includes('asrama c') || asr.includes('asrama d') || asr.includes('asrama e') || asr.includes('asrama f') || ['b', 'c', 'd', 'e', 'f'].includes(asr.trim());
      if (isPutra) baseClauses.push("LOWER(km.nama_kelas) LIKE '%putra%'");
      else if (isPutri) baseClauses.push("LOWER(km.nama_kelas) LIKE '%putri%'");
    }

    if (kategori === 'putra') {
      baseClauses.push("LOWER(km.nama_kelas) LIKE '%putra%'");
    } else if (kategori === 'putri') {
      baseClauses.push("LOWER(km.nama_kelas) LIKE '%putri%'");
    }

    const whereClauses: string[] = [...baseClauses];
    const queryParams: any[] = [...baseParams];

    if (targetGuruId && targetGuruId !== 'all') {
      whereClauses.push('g.guru_id = ?');
      queryParams.push(targetGuruId);
    }
    if (kelasFilterId && kelasFilterId !== 'all') {
      whereClauses.push('km.kelas_id = ?');
      queryParams.push(kelasFilterId);
    }

    // 1. Ambil daftar jadwal guru Madin beserta kelas
    const [scheduleRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        jm.jadwal_id,
        jm.guru_id,
        g.nama as guru_nama,
        COALESCE(g.nip, '-') as guru_nip,
        COALESCE(g.no_hp, '') as no_hp,
        COALESCE(g.foto, '') as foto,
        jm.kelas_madin_id,
        km.nama_kelas,
        jm.mata_pelajaran
      FROM jadwal_madin jm
      JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
      JOIN guru g ON jm.guru_id = g.guru_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY g.nama ASC, km.nama_kelas ASC, jm.mata_pelajaran ASC
    `, queryParams);

    // Ambil daftar opsi kelas untuk filter di UI (menghormati RBAC & kategori unit)
    let kelasOptions: Array<{ kelas_id: number; nama_kelas: string }> = [];
    try {
      const [kRows] = await pool.execute<RowDataPacket[]>(`
        SELECT DISTINCT km.kelas_id, km.nama_kelas
        FROM jadwal_madin jm
        JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
        JOIN guru g ON jm.guru_id = g.guru_id
        WHERE ${baseClauses.join(' AND ')}
        ORDER BY km.nama_kelas ASC
      `, baseParams);
      kelasOptions = kRows.map(r => ({ kelas_id: Number(r.kelas_id), nama_kelas: r.nama_kelas }));
    } catch (_) {}

    if (!scheduleRows || scheduleRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        kelas_options: kelasOptions,
        semester,
        tahun_ajaran: tahunAjaran,
        total_guru: 0,
      }, { headers: noCacheHeaders });
    }

    // Lookup opsional nama kitab dari kurikulum_madin
    const kitabMap: Record<string, string> = {};
    try {
      const [kurRows] = await pool.execute<RowDataPacket[]>(
        "SELECT mata_pelajaran, kitab FROM kurikulum_madin WHERE mata_pelajaran IS NOT NULL AND kitab IS NOT NULL AND kitab != ''"
      );
      kurRows.forEach(r => {
        const key = String(r.mata_pelajaran || '').trim().toUpperCase();
        if (key && !kitabMap[key]) kitabMap[key] = r.kitab;
      });
    } catch (_) {}

    // 2. Ambil daftar santri per kelas (mendukung kelas_madin_id maupun kelas_madin_2_id)
    const [muridClassRows] = await pool.execute<RowDataPacket[]>(`
      SELECT kelas_id, COUNT(DISTINCT murid_id) as total_santri FROM (
        SELECT murid_id, kelas_madin_id as kelas_id FROM murid WHERE kelas_madin_id IS NOT NULL
        UNION
        SELECT murid_id, kelas_madin_2_id as kelas_id FROM murid WHERE kelas_madin_2_id IS NOT NULL
      ) m_kelas
      GROUP BY kelas_id
    `);
    const santriPerKelas: Record<number, number> = {};
    muridClassRows.forEach(r => {
      santriPerKelas[Number(r.kelas_id)] = Number(r.total_santri || 0);
    });

    // 3. Ambil nilai santri yang sudah tersimpan pada semester & tahun ajaran ini (abaikan baris residu kosong)
    const [scoredRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        ns.murid_id,
        ns.kelas_madin_id as ns_kelas_id,
        m.kelas_madin_id as m_k1,
        m.kelas_madin_2_id as m_k2,
        ns.mata_pelajaran
      FROM nilai_santri ns
      JOIN murid m ON ns.murid_id = m.murid_id
      WHERE ns.semester = ? AND ns.tahun_ajaran = ?
        AND (ns.nilai_harian IS NOT NULL OR ns.nilai_lisan IS NOT NULL OR ns.nilai_uts IS NOT NULL OR ns.nilai_uas IS NOT NULL OR ns.nilai_akhir IS NOT NULL)
        AND NOT ${residualZeroConditionSql('ns')}
    `, [semester, tahunAjaran]);

    const scoredSets: Record<string, Set<number>> = {};
    const addScoreEntry = (kId: any, mapelKey: string, mId: number) => {
      if (!kId) return;
      const key = `${Number(kId)}_${mapelKey}`;
      if (!scoredSets[key]) scoredSets[key] = new Set();
      scoredSets[key].add(mId);
    };

    scoredRows.forEach(r => {
      const mapelKey = String(r.mata_pelajaran || '').trim().toUpperCase();
      if (!mapelKey) return;
      const mId = Number(r.murid_id);
      if (r.ns_kelas_id) addScoreEntry(r.ns_kelas_id, mapelKey, mId);
      if (r.m_k1 && Number(r.m_k1) !== Number(r.ns_kelas_id)) addScoreEntry(r.m_k1, mapelKey, mId);
      if (r.m_k2 && Number(r.m_k2) !== Number(r.ns_kelas_id)) addScoreEntry(r.m_k2, mapelKey, mId);
    });

    // 4. Kelompokkan jadwal berdasarkan guru_id
    const teacherMap: Record<number, {
      guru_id: number;
      guru_nama: string;
      guru_nip: string;
      no_hp: string;
      foto: string;
      mapel_list: Array<{
        jadwal_id: number;
        kelas_id: number;
        nama_kelas: string;
        mata_pelajaran: string;
        kitab: string;
        total_santri: number;
        total_dinilai: number;
      }>;
    }> = {};

    scheduleRows.forEach(r => {
      const gId = Number(r.guru_id);
      if (!teacherMap[gId]) {
        teacherMap[gId] = {
          guru_id: gId,
          guru_nama: r.guru_nama,
          guru_nip: r.guru_nip,
          no_hp: r.no_hp,
          foto: r.foto,
          mapel_list: [],
        };
      }

      const kelasId = Number(r.kelas_madin_id);
      const mapelName = String(r.mata_pelajaran || '').trim();
      const mapelUpper = mapelName.toUpperCase();
      const santriCount = santriPerKelas[kelasId] || 0;
      const scoreKey = `${kelasId}_${mapelUpper}`;
      const scoredCount = scoredSets[scoreKey] ? scoredSets[scoreKey].size : 0;

      const exists = teacherMap[gId].mapel_list.some(
        m => m.kelas_id === kelasId && m.mata_pelajaran.toLowerCase() === mapelName.toLowerCase()
      );
      if (!exists) {
        teacherMap[gId].mapel_list.push({
          jadwal_id: Number(r.jadwal_id),
          kelas_id: kelasId,
          nama_kelas: r.nama_kelas,
          mata_pelajaran: mapelName,
          kitab: kitabMap[mapelUpper] || '',
          total_santri: santriCount,
          total_dinilai: scoredCount,
        });
      }
    });

    const teacherArray = Object.values(teacherMap);

    // 5. Buat short token batch untuk setiap guru
    const tokenItems = teacherArray.map(t => ({
      payload: {
        purpose: 'penilaian_input',
        guru_id: t.guru_id,
        guru_nama: t.guru_nama,
        nip: t.guru_nip,
        kategori,
        semester,
        tahun_ajaran: tahunAjaran,
        duration_label: durationLabel,
        exp_date_formatted: expDateFormatted,
        role: 'guru',
      },
      expiresIn: expiryDuration,
      type: 'penilaian_input',
    }));

    let previewTokens: string[] = [];
    try {
      previewTokens = await createShortTokensBatch(tokenItems);
    } catch (err) {
      console.warn('Gagal membuat short token batch:', err);
      previewTokens = teacherArray.map(() => '');
    }

    // 6. Format hasil akhir
    const formattedData = teacherArray.map((t, idx) => {
      const totalSantriTarget = t.mapel_list.reduce((acc, cur) => acc + cur.total_santri, 0);
      const totalSantriDinilai = t.mapel_list.reduce((acc, cur) => acc + Math.min(cur.total_dinilai, cur.total_santri), 0);
      const persentase = totalSantriTarget > 0
        ? Math.round((totalSantriDinilai / totalSantriTarget) * 100)
        : 0;

      let statusKelengkapan: 'belum' | 'sebagian' | 'lengkap' = 'belum';
      if (totalSantriDinilai >= totalSantriTarget && totalSantriTarget > 0) {
        statusKelengkapan = 'lengkap';
      } else if (totalSantriDinilai > 0) {
        statusKelengkapan = 'sebagian';
      }

      const daftarMapelText = t.mapel_list
        .map(m => `• ${m.nama_kelas} — *${m.mata_pelajaran}* (${m.total_dinilai}/${m.total_santri} Santri)`)
        .join('\n');

      const daftarMapelRingkas = t.mapel_list
        .map(m => `${m.nama_kelas} (${m.mata_pelajaran})`)
        .join(', ');

      return {
        id: `guru_penilaian_${t.guru_id}`,
        guru_id: t.guru_id,
        nama: t.guru_nama,
        guru_nama: t.guru_nama,
        nip: t.guru_nip,
        no_hp: t.no_hp,
        foto: t.foto,
        mapel_list: t.mapel_list,
        total_mapel: t.mapel_list.length,
        total_santri_target: totalSantriTarget,
        total_santri_dinilai: totalSantriDinilai,
        persentase_selesai: persentase,
        status_kelengkapan: statusKelengkapan,
        daftar_mapel_text: daftarMapelText,
        daftar_mapel_ringkas: daftarMapelRingkas,
        preview_token: previewTokens[idx] || '',
        token_duration_label: durationLabel,
        token_exp_date: expDateFormatted,
        token_exp_timestamp: expiryDateObj.getTime(),
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedData,
      kelas_options: kelasOptions,
      semester,
      tahun_ajaran: tahunAjaran,
      total_guru: formattedData.length,
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error('Error in shortcut-guru route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers: noCacheHeaders });
  }
}
