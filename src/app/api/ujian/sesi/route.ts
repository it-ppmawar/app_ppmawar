import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
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

    const { searchParams } = new URL(request.url);
    const ujianId = searchParams.get('ujian_id');

    if (!ujianId) return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, 
              u.judul as ujian_judul,
              u.durasi_menit,
              (SELECT COUNT(*) FROM ujian_hasil_santri WHERE ujian_id = s.ujian_id) as total_peserta
       FROM ujian_sesi_pengawas s
       JOIN ujian_madin u ON s.ujian_id = u.id
       WHERE s.ujian_id = ?
       LIMIT 1`,
      [ujianId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Sesi ujian belum dibuat.' });
    }

    // Ambil default koordinat pesantren dari pengaturan_absensi_otomatis
    let defaultPesantren = {
      lat: -7.0359924,
      lng: 112.3507981,
      radius: 200,
    };
    try {
      const [settings] = await pool.execute<RowDataPacket[]>(
        "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('lat_pesantren', 'lng_pesantren', 'radius_absen')"
      );
      settings.forEach((r: any) => {
        if (r.nama_pengaturan === 'lat_pesantren' && r.nilai) defaultPesantren.lat = parseFloat(r.nilai);
        if (r.nama_pengaturan === 'lng_pesantren' && r.nilai) defaultPesantren.lng = parseFloat(r.nilai);
        if (r.nama_pengaturan === 'radius_absen' && r.nilai) defaultPesantren.radius = parseFloat(r.nilai);
      });
    } catch (e) {
      // ignore
    }

    return NextResponse.json({
      success: true,
      sesi: rows[0],
      default_pesantren: defaultPesantren,
    });
  } catch (error: any) {
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
    const userRoleLower = (payload?.role || '').toLowerCase();
    const canManageSesi = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!payload || !canManageSesi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { ujian_id, action } = body;

    if (!ujian_id) return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });

    // 1. Generate Token Baru
    if (action === 'new_token') {
      const newToken = generateExamToken();
      await pool.execute(
        `UPDATE ujian_sesi_pengawas SET
          token_ujian = ?,
          status_sesi = 'buka',
          pengawas_user_id = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE ujian_id = ?`,
        [newToken, payload.userId || null, ujian_id]
      );
      return NextResponse.json({
        success: true,
        message: 'Token ujian baru berhasil dibuat!',
        token_ujian: newToken,
      });
    }

    // 2. Buka / Tutup Sesi
    if (action === 'toggle_status') {
      const { status } = body; // 'buka' | 'tertutup' | 'selesai'
      await pool.execute(
        'UPDATE ujian_sesi_pengawas SET status_sesi = ?, updated_at = CURRENT_TIMESTAMP WHERE ujian_id = ?',
        [status, ujian_id]
      );
      return NextResponse.json({
        success: true,
        message: `Sesi ujian berhasil diubah menjadi: ${status}.`,
      });
    }

    // 3. Update Geofence & Koordinat Acuan (Pengawas / Pesantren)
    if (action === 'update_geofence') {
      const { lat_target, lng_target, max_radius_meter, wajib_geofence } = body;
      await pool.execute(
        `UPDATE ujian_sesi_pengawas SET
          lat_target = ?,
          lng_target = ?,
          max_radius_meter = ?,
          wajib_geofence = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE ujian_id = ?`,
        [
          lat_target !== undefined && lat_target !== null && lat_target !== '' ? lat_target : null,
          lng_target !== undefined && lng_target !== null && lng_target !== '' ? lng_target : null,
          max_radius_meter ? Number(max_radius_meter) : 200,
          wajib_geofence !== undefined ? (wajib_geofence ? 1 : 0) : 1,
          ujian_id,
        ]
      );
      return NextResponse.json({
        success: true,
        message: 'Titik acuan & batas radius ujian berhasil diperbarui!',
      });
    }

    // 4. Update Pengaturan Keamanan Sesi Umum
    const { wajib_token, wajib_geofence, max_radius_meter, lat_target, lng_target } = body;
    await pool.execute(
      `UPDATE ujian_sesi_pengawas SET
        wajib_token = COALESCE(?, wajib_token),
        wajib_geofence = COALESCE(?, wajib_geofence),
        max_radius_meter = COALESCE(?, max_radius_meter),
        lat_target = COALESCE(?, lat_target),
        lng_target = COALESCE(?, lng_target),
        updated_at = CURRENT_TIMESTAMP
       WHERE ujian_id = ?`,
      [
        wajib_token !== undefined ? (wajib_token ? 1 : 0) : null,
        wajib_geofence !== undefined ? (wajib_geofence ? 1 : 0) : null,
        max_radius_meter ? Number(max_radius_meter) : null,
        lat_target !== undefined ? lat_target : null,
        lng_target !== undefined ? lng_target : null,
        ujian_id,
      ]
    );

    return NextResponse.json({ success: true, message: 'Pengaturan sesi ujian berhasil diperbarui.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
