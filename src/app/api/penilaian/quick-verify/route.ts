import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { resolveToken } from '@/lib/auth/shortToken';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

const noCacheHeaders = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: Request) {
  try {
    await ensurePenilaianDB();

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || searchParams.get('t');

    if (!token) {
      return NextResponse.json({ error: 'Token diperlukan' }, { status: 400, headers: noCacheHeaders });
    }

    const payload = await resolveToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401, headers: noCacheHeaders });
    }
    if (payload.error) {
      return NextResponse.json({ error: 'Tautan telah kedaluwarsa atau tidak valid' }, { status: 401, headers: noCacheHeaders });
    }
    if (payload.purpose && payload.purpose !== 'penilaian_input') {
      return NextResponse.json({ error: 'Tautan ini tidak ditujukan untuk penginputan nilai' }, { status: 403, headers: noCacheHeaders });
    }

    const guruId = payload.guru_id || payload.guruId;
    if (!guruId) {
      return NextResponse.json({ error: 'Data pengajar tidak ditemukan dalam token' }, { status: 400, headers: noCacheHeaders });
    }

    // Ambil info guru
    const [guruRows] = await pool.execute<RowDataPacket[]>(`
      SELECT guru_id, nama, COALESCE(nip, '-') as nip, COALESCE(no_hp, '') as no_hp, COALESCE(foto, '') as foto
      FROM guru
      WHERE guru_id = ?
      LIMIT 1
    `, [guruId]);

    if (guruRows.length === 0) {
      return NextResponse.json({ error: 'Guru tidak ditemukan di pangkalan data' }, { status: 404, headers: noCacheHeaders });
    }

    const guru = guruRows[0];

    // Lookup kitab opsional dari kurikulum_madin
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

    // Ambil daftar kelas & mapel yang diajar guru dari jadwal_madin
    const [scheduleRows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        jm.jadwal_id,
        jm.kelas_madin_id as kelas_id,
        km.nama_kelas,
        jm.mata_pelajaran
      FROM jadwal_madin jm
      JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
      WHERE jm.guru_id = ? AND jm.mata_pelajaran IS NOT NULL AND TRIM(jm.mata_pelajaran) != ''
      ORDER BY km.nama_kelas ASC, jm.mata_pelajaran ASC
    `, [guruId]);

    // Ambil juga kelas di mana guru adalah Wali Kelas (untuk akses Leger Kolektif)
    const [waliKelasRows] = await pool.execute<RowDataPacket[]>(`
      SELECT kelas_id, nama_kelas
      FROM kelas_madin
      WHERE guru_id = ?
      ORDER BY nama_kelas ASC
    `, [guruId]);

    // Kelompokkan mapel per kelas
    const classMap: Record<number, {
      kelas_id: number;
      nama_kelas: string;
      is_wali_kelas: boolean;
      mapels: Array<{ mata_pelajaran: string; kitab: string }>;
    }> = {};

    waliKelasRows.forEach(w => {
      const kId = Number(w.kelas_id);
      if (!classMap[kId]) {
        classMap[kId] = {
          kelas_id: kId,
          nama_kelas: w.nama_kelas,
          is_wali_kelas: true,
          mapels: [],
        };
      }
    });

    scheduleRows.forEach(r => {
      const kId = Number(r.kelas_id);
      if (!classMap[kId]) {
        classMap[kId] = {
          kelas_id: kId,
          nama_kelas: r.nama_kelas,
          is_wali_kelas: false,
          mapels: [],
        };
      }
      const mapelName = String(r.mata_pelajaran || '').trim();
      const exists = classMap[kId].mapels.some(m => m.mata_pelajaran.toLowerCase() === mapelName.toLowerCase());
      if (!exists) {
        classMap[kId].mapels.push({
          mata_pelajaran: mapelName,
          kitab: kitabMap[mapelName.toUpperCase()] || '',
        });
      }
    });

    const classes = Object.values(classMap).sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, 'id'));

    // Ambil tanggal kadaluarsa token (dari payload atau app_short_tokens)
    let expDateFormatted = payload.exp_date_formatted || '';
    const durationLabel = payload.duration_label || '';
    if (!expDateFormatted && !token.startsWith('s_') && !token.startsWith('eyJ')) {
      try {
        const [tokRows] = await pool.execute<RowDataPacket[]>(
          'SELECT expires_at FROM app_short_tokens WHERE token = ? LIMIT 1',
          [token]
        );
        if (tokRows.length > 0 && tokRows[0].expires_at) {
          expDateFormatted = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(tokRows[0].expires_at));
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      data: {
        guru_id: guru.guru_id,
        nama: guru.nama,
        nip: guru.nip,
        no_hp: guru.no_hp,
        foto: guru.foto,
        classes,
        semester: payload.semester || '1',
        tahun_ajaran: payload.tahun_ajaran || '2025/2026',
        kategori: payload.kategori || 'madin',
        exp_date_formatted: expDateFormatted,
        duration_label: durationLabel,
      }
    }, { headers: noCacheHeaders });

  } catch (error: any) {
    console.error('Error in quick-verify route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers: noCacheHeaders });
  }
}
