import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';

export const dynamic = 'force-dynamic';

function generateExamToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = 'MW';
  for (let i = 0; i < 4; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function GET(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, guruId, muridId, userId } = payload;
    const userRoleLower = (role || '').toLowerCase();
    const { searchParams } = new URL(request.url);
    const filterKelas = searchParams.get('kelas_id');
    const filterMapel = searchParams.get('mapel');
    const semester = searchParams.get('semester') || '1';
    const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';

    const isWaliOrSantri = userRoleLower === 'wali_murid' || userRoleLower === 'santri';

    if (isWaliOrSantri) {
      if (!muridId) {
        return NextResponse.json({ success: true, role: userRoleLower, exams: [] });
      }

      // Ambil data santri untuk tahu kelas madinnya
      const [muridRows] = await pool.execute<RowDataPacket[]>(
        'SELECT murid_id, nama, nis, kelas_madin_id, kelas_madin_2_id FROM murid WHERE murid_id = ? LIMIT 1',
        [muridId]
      );
      const m = muridRows[0] || {};
      const santriKelasId = m.kelas_madin_id || m.kelas_madin_2_id || null;

      // Ambil ujian yang ditujukan untuk kelas santri atau semua kelas (NULL)
      const [exams] = await pool.execute<RowDataPacket[]>(
        `SELECT u.*,
                km.nama_kelas,
                COALESCE(s.token_ujian, '') as token_ujian,
                COALESCE(s.wajib_token, 1) as wajib_token,
                COALESCE(s.wajib_geofence, 1) as wajib_geofence,
                COALESCE(s.max_radius_meter, 200) as max_radius_meter,
                COALESCE(s.status_sesi, 'buka') as status_sesi,
                (SELECT COUNT(*) FROM ujian_soal WHERE ujian_id = u.id) as total_soal,
                uh.id as hasil_id,
                uh.skor_akhir,
                uh.jumlah_benar,
                uh.jumlah_salah,
                uh.status_lulus,
                uh.waktu_selesai
         FROM ujian_madin u
         LEFT JOIN kelas_madin km ON u.kelas_madin_id = km.kelas_id
         LEFT JOIN ujian_sesi_pengawas s ON u.id = s.ujian_id
         LEFT JOIN ujian_hasil_santri uh ON u.id = uh.ujian_id AND uh.murid_id = ?
         WHERE u.is_active = 1
           AND u.semester = ?
           AND u.tahun_ajaran = ?
           AND (u.kelas_madin_id IS NULL OR u.kelas_madin_id = ? OR u.kelas_madin_id = ?)
         ORDER BY u.id DESC`,
        [muridId, semester, tahunAjaran, santriKelasId, santriKelasId]
      );

      return NextResponse.json({
        success: true,
        role: 'santri',
        santri: { murid_id: m.murid_id, nama: m.nama, nis: m.nis, kelas_id: santriKelasId },
        exams,
      });
    }

    // Role Guru, Staff, Admin
    let whereClause = '1=1';
    let params: any[] = [];

    if (userRoleLower === 'guru') {
      let activeGuruId = guruId;
      if (!activeGuruId && userId) {
        try {
          const [gRows] = await pool.execute<RowDataPacket[]>(
            'SELECT guru_id FROM guru WHERE user_id = ? LIMIT 1',
            [userId]
          );
          if (gRows.length > 0) activeGuruId = gRows[0].guru_id;
        } catch (e) {}
      }

      if (activeGuruId) {
        whereClause = `(u.guru_id = ? OR u.created_by = ? OR u.mata_pelajaran IN (SELECT DISTINCT mata_pelajaran FROM jadwal_madin WHERE guru_id = ?))`;
        params.push(activeGuruId, userId || 0, activeGuruId);
      } else if (userId) {
        whereClause = `(u.created_by = ?)`;
        params.push(userId);
      }
    }

    if (filterKelas && filterKelas !== 'SEMUA') {
      whereClause += ' AND u.kelas_madin_id = ?';
      params.push(filterKelas);
    }
    if (filterMapel && filterMapel !== 'SEMUA') {
      whereClause += ' AND u.mata_pelajaran = ?';
      params.push(filterMapel);
    }

    const [exams] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*,
              km.nama_kelas,
              g.nama as nama_guru,
              COALESCE(s.token_ujian, '') as token_ujian,
              COALESCE(s.wajib_token, 1) as wajib_token,
              COALESCE(s.wajib_geofence, 1) as wajib_geofence,
              COALESCE(s.max_radius_meter, 200) as max_radius_meter,
              COALESCE(s.status_sesi, 'buka') as status_sesi,
              (SELECT COUNT(*) FROM ujian_soal WHERE ujian_id = u.id) as total_soal,
              (CASE WHEN u.kelas_madin_id IS NOT NULL THEN (SELECT COUNT(*) FROM murid WHERE kelas_madin_id = u.kelas_madin_id OR kelas_madin_2_id = u.kelas_madin_id) ELSE 0 END) as total_peserta
       FROM ujian_madin u
       LEFT JOIN kelas_madin km ON u.kelas_madin_id = km.kelas_id
       LEFT JOIN guru g ON u.guru_id = g.guru_id
       LEFT JOIN ujian_sesi_pengawas s ON u.id = s.ujian_id
       WHERE ${whereClause}
       ORDER BY u.id DESC`,
      params
    );

    return NextResponse.json({
      success: true,
      role: userRoleLower,
      exams,
    });
  } catch (error: any) {
    console.error('Error in GET /api/ujian:', error);
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

    const { role, guruId, userId } = payload;
    const userRoleLower = (role || '').toLowerCase();
    const canManageUjian = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!canManageUjian) {
      return NextResponse.json({ error: 'Hanya Pengajar / Admin yang dapat membuat ujian.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      judul,
      deskripsi,
      mata_pelajaran,
      kitab,
      kelas_madin_id,
      semester = '1',
      tahun_ajaran = '2025/2026',
      jenis_ujian = 'harian', // harian | uts | uas
      durasi_menit = 45,
      passing_grade = 70,
      acak_soal = 1,
      acak_opsi = 1,
      anti_curang = 1,
      max_pelanggaran = 3,
      wajib_fullscreen = 1,
      wajib_token = 1,
      wajib_geofence = 1,
      max_radius_meter = 200,
      quizb_id = null,
      quizb_embed_url = null,
    } = body;

    if (!judul || !mata_pelajaran) {
      return NextResponse.json({ error: 'Judul ujian dan mata pelajaran wajib diisi.' }, { status: 400 });
    }

    const targetGuruId = role === 'guru' ? (guruId || null) : (body.guru_id || null);

    const [insertResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO ujian_madin 
        (judul, deskripsi, mata_pelajaran, kitab, kelas_madin_id, semester, tahun_ajaran, jenis_ujian, durasi_menit, passing_grade, acak_soal, acak_opsi, anti_curang, max_pelanggaran, wajib_fullscreen, quizb_id, quizb_embed_url, guru_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        judul.trim(),
        deskripsi ? deskripsi.trim() : null,
        mata_pelajaran.trim(),
        kitab ? kitab.trim() : null,
        kelas_madin_id ? Number(kelas_madin_id) : null,
        semester,
        tahun_ajaran,
        jenis_ujian,
        Number(durasi_menit) || 45,
        Number(passing_grade) || 70,
        acak_soal ? 1 : 0,
        acak_opsi ? 1 : 0,
        anti_curang ? 1 : 0,
        Number(max_pelanggaran) || 3,
        wajib_fullscreen ? 1 : 0,
        quizb_id ? String(quizb_id) : null,
        quizb_embed_url ? String(quizb_embed_url) : null,
        targetGuruId,
        userId || null,
      ]
    );

    const newUjianId = insertResult.insertId;

    // Ambil default lat/lng pesantren untuk sesi ujian
    let latPesantren: number | null = null;
    let lngPesantren: number | null = null;
    try {
      const [settingRows] = await pool.execute<RowDataPacket[]>(
        "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('lat_pesantren', 'lng_pesantren')"
      );
      settingRows.forEach((r: any) => {
        if (r.nama_pengaturan === 'lat_pesantren') latPesantren = parseFloat(r.nilai);
        if (r.nama_pengaturan === 'lng_pesantren') lngPesantren = parseFloat(r.nilai);
      });
    } catch (e) {
      // ignore
    }

    // Buat Sesi Pengawas awal & Token Ujian Otomatis
    const tokenAwal = generateExamToken();
    await pool.execute(
      `INSERT INTO ujian_sesi_pengawas 
        (ujian_id, token_ujian, wajib_token, wajib_geofence, max_radius_meter, lat_target, lng_target, status_sesi, pengawas_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'buka', ?)`,
      [
        newUjianId,
        tokenAwal,
        wajib_token ? 1 : 0,
        wajib_geofence ? 1 : 0,
        Number(max_radius_meter) || 200,
        latPesantren,
        lngPesantren,
        userId || null,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Ujian berhasil dibuat.',
      ujian_id: newUjianId,
      token_ujian: tokenAwal,
    });
  } catch (error: any) {
    console.error('Error in POST /api/ujian:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const userRoleLower = (payload.role || '').toLowerCase();
    const canManageUjian = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!canManageUjian) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, is_active } = body;

    if (!id) return NextResponse.json({ error: 'ID Ujian wajib diisi' }, { status: 400 });

    // Toggle active status cepat
    if (is_active !== undefined) {
      await pool.execute('UPDATE ujian_madin SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
      return NextResponse.json({ success: true, message: 'Status ujian diperbarui.' });
    }

    // Full update
    const {
      judul,
      deskripsi,
      mata_pelajaran,
      kitab,
      kelas_madin_id,
      jenis_ujian,
      durasi_menit,
      passing_grade,
      acak_soal,
      acak_opsi,
      anti_curang,
      max_pelanggaran,
      wajib_fullscreen,
    } = body;

    await pool.execute(
      `UPDATE ujian_madin SET
        judul = COALESCE(?, judul),
        deskripsi = COALESCE(?, deskripsi),
        mata_pelajaran = COALESCE(?, mata_pelajaran),
        kitab = COALESCE(?, kitab),
        kelas_madin_id = ?,
        jenis_ujian = COALESCE(?, jenis_ujian),
        durasi_menit = COALESCE(?, durasi_menit),
        passing_grade = COALESCE(?, passing_grade),
        acak_soal = COALESCE(?, acak_soal),
        acak_opsi = COALESCE(?, acak_opsi),
        anti_curang = COALESCE(?, anti_curang),
        max_pelanggaran = COALESCE(?, max_pelanggaran),
        wajib_fullscreen = COALESCE(?, wajib_fullscreen)
       WHERE id = ?`,
      [
        judul || null,
        deskripsi || null,
        mata_pelajaran || null,
        kitab || null,
        kelas_madin_id ? Number(kelas_madin_id) : null,
        jenis_ujian || null,
        durasi_menit ? Number(durasi_menit) : null,
        passing_grade ? Number(passing_grade) : null,
        acak_soal !== undefined ? (acak_soal ? 1 : 0) : null,
        acak_opsi !== undefined ? (acak_opsi ? 1 : 0) : null,
        anti_curang !== undefined ? (anti_curang ? 1 : 0) : null,
        max_pelanggaran !== undefined ? Number(max_pelanggaran) : null,
        wajib_fullscreen !== undefined ? (wajib_fullscreen ? 1 : 0) : null,
        id,
      ]
    );

    return NextResponse.json({ success: true, message: 'Data ujian berhasil diperbarui.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const userRoleLower = (payload.role || '').toLowerCase();
    const canManageUjian = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!canManageUjian) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID Ujian diperlukan.' }, { status: 400 });

    await pool.execute('DELETE FROM ujian_madin WHERE id = ?', [id]);
    await pool.execute('DELETE FROM ujian_soal WHERE ujian_id = ?', [id]);
    await pool.execute('DELETE FROM ujian_sesi_pengawas WHERE ujian_id = ?', [id]);
    await pool.execute('DELETE FROM ujian_essay_jawaban WHERE ujian_id = ?', [id]);
    await pool.execute('DELETE FROM ujian_hasil_santri WHERE ujian_id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Ujian beserta soal berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
