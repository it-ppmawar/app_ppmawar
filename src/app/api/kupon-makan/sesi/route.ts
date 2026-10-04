import { NextResponse, NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensureKuponMakanDB, detectActiveSesiWIB } from '@/lib/ensureKuponMakanDB';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

async function checkAuth(customAllowedRoles?: string[]) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { ok: false, status: 401, error: 'Unauthorized: Silakan login terlebih dahulu.' };

  const payload = verifyToken(token) as any;
  if (!payload) return { ok: false, status: 401, error: 'Token invalid.' };

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
  const allowed = customAllowedRoles || ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'pengurus'];
  const isAllowed = (allowed.includes(role) || isPengasuhOrPengurus) && !isMurniGuru;

  if (!isAllowed) {
    return { ok: false, status: 403, error: 'Akses ditolak: Akun Anda tidak memiliki izin mengakses fitur kupon makan.' };
  }

  return { ok: true, payload, role, isPengasuhOrPengurus };
}

// GET: Ambil daftar seluruh sesi dan sesi aktif saat ini
export async function GET() {
  try {
    const auth = await checkAuth();
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { activeKode, activeNama, sessions } = await detectActiveSesiWIB();

    const [presetRows] = await pool.query<RowDataPacket[]>(
      `SELECT nilai FROM pengaturan_kupon_makan WHERE nama_pengaturan = 'preset_aktif' LIMIT 1`
    );
    const presetAktif = presetRows.length > 0 ? presetRows[0].nilai : 'reguler_2x';

    return NextResponse.json({
      success: true,
      activeSesi: activeKode,
      presetAktif,
      sessions
    });
  } catch (error: any) {
    console.error('Error GET /api/kupon-makan/sesi:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: Tambah atau update waktu sesi spesifik (Hanya admin, staff, pengasuh, pengurus_asrama)
export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(['admin', 'staff', 'pengasuh', 'pengurus_asrama']);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await ensureKuponMakanDB();
    const body = await request.json();
    const { id, kode_sesi, nama_sesi, jam_mulai, jam_selesai, is_aktif, keterangan } = body;

    if (!kode_sesi || !nama_sesi || !jam_mulai || !jam_selesai) {
      return NextResponse.json(
        { success: false, message: 'Kode, nama sesi, jam mulai, dan jam selesai wajib diisi.' },
        { status: 400 }
      );
    }

    if (id) {
      await pool.query(
        `UPDATE jadwal_sesi_makan 
         SET nama_sesi = ?, jam_mulai = ?, jam_selesai = ?, is_aktif = ?, keterangan = ?
         WHERE id = ?`,
        [nama_sesi, jam_mulai, jam_selesai, is_aktif ? 1 : 0, keterangan || null, id]
      );
    } else {
      await pool.query(
        `INSERT INTO jadwal_sesi_makan (kode_sesi, nama_sesi, jam_mulai, jam_selesai, is_aktif, keterangan)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           nama_sesi = VALUES(nama_sesi),
           jam_mulai = VALUES(jam_mulai),
           jam_selesai = VALUES(jam_selesai),
           is_aktif = VALUES(is_aktif),
           keterangan = VALUES(keterangan)`,
        [kode_sesi, nama_sesi, jam_mulai, jam_selesai, is_aktif ? 1 : 0, keterangan || null]
      );
    }

    await pool.query(
      `UPDATE pengaturan_kupon_makan SET nilai = 'kustom' WHERE nama_pengaturan = 'preset_aktif'`
    );

    return NextResponse.json({ success: true, message: 'Jadwal sesi berhasil disimpan.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT: Terapkan Template / Preset Cepat (reguler_2x, ramadhan, reguler_3x)
export async function PUT(request: NextRequest) {
  try {
    const auth = await checkAuth(['admin', 'staff', 'pengasuh', 'pengurus_asrama']);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await ensureKuponMakanDB();
    const body = await request.json();
    const { preset } = body;

    if (!['reguler_2x', 'ramadhan', 'reguler_3x'].includes(preset)) {
      return NextResponse.json({ success: false, message: 'Preset tidak valid.' }, { status: 400 });
    }

    if (preset === 'reguler_2x') {
      // Mode Reguler Pesantren 2x Sehari: Sarapan Pagi (05.30-06.30) & Makan Sore (16.30-17.30)
      await pool.query(
        `UPDATE jadwal_sesi_makan 
         SET is_aktif = CASE 
           WHEN kode_sesi IN ('pagi', 'malam') THEN 1 
           ELSE 0 
         END,
         jam_mulai = CASE
           WHEN kode_sesi = 'pagi' THEN '05:30:00'
           WHEN kode_sesi = 'malam' THEN '16:30:00'
           ELSE jam_mulai
         END,
         jam_selesai = CASE
           WHEN kode_sesi = 'pagi' THEN '06:30:00'
           WHEN kode_sesi = 'malam' THEN '17:30:00'
           ELSE jam_selesai
         END`
      );
    } else if (preset === 'ramadhan') {
      // Mode Ramadhan (Sahur & Buka Puasa)
      await pool.query(
        `UPDATE jadwal_sesi_makan 
         SET is_aktif = CASE 
           WHEN kode_sesi IN ('sahur', 'buka_puasa') THEN 1 
           ELSE 0 
         END,
         jam_mulai = CASE
           WHEN kode_sesi = 'sahur' THEN '02:30:00'
           WHEN kode_sesi = 'buka_puasa' THEN '17:30:00'
           ELSE jam_mulai
         END,
         jam_selesai = CASE
           WHEN kode_sesi = 'sahur' THEN '04:30:00'
           WHEN kode_sesi = 'buka_puasa' THEN '20:00:00'
           ELSE jam_selesai
         END`
      );
    } else if (preset === 'reguler_3x') {
      // Mode 3x Sehari (Pagi, Siang, Malam)
      await pool.query(
        `UPDATE jadwal_sesi_makan 
         SET is_aktif = CASE 
           WHEN kode_sesi IN ('pagi', 'siang', 'malam') THEN 1 
           ELSE 0 
         END,
         jam_mulai = CASE
           WHEN kode_sesi = 'pagi' THEN '06:00:00'
           WHEN kode_sesi = 'siang' THEN '11:00:00'
           WHEN kode_sesi = 'malam' THEN '16:30:00'
           ELSE jam_mulai
         END,
         jam_selesai = CASE
           WHEN kode_sesi = 'pagi' THEN '08:30:00'
           WHEN kode_sesi = 'siang' THEN '14:30:00'
           WHEN kode_sesi = 'malam' THEN '20:30:00'
           ELSE jam_selesai
         END`
      );
    }

    // Update setting preset_aktif
    await pool.query(
      `INSERT INTO pengaturan_kupon_makan (nama_pengaturan, nilai) VALUES ('preset_aktif', ?)
       ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
      [preset]
    );

    return NextResponse.json({
      success: true,
      message: `Preset "${preset}" berhasil diterapkan.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
