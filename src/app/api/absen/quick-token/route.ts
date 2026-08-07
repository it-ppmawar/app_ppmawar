import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminPayload = verifyToken(token);
    if (!adminPayload) {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401 });
    }

    const { role } = adminPayload as any;
    if (role !== 'admin' && role !== 'staff' && role !== 'guru' && role !== 'pengurus_asrama') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { guru_id, jadwal_id, tipe, date } = body;

    if (!guru_id || !jadwal_id || !tipe) {
      return NextResponse.json({ error: 'Parameter tidak lengkap (guru_id, jadwal_id, tipe)' }, { status: 400 });
    }

    // Ambil info guru
    const [guruRows] = await pool.execute<RowDataPacket[]>(
      'SELECT guru_id, nama, user_id FROM guru WHERE guru_id = ?',
      [guru_id]
    );

    if (guruRows.length === 0) {
      return NextResponse.json({ error: 'Guru tidak ditemukan' }, { status: 404 });
    }

    const guruInfo = guruRows[0];
    const targetDate = date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

    // Ambil pengaturan waktu tenggang (jam)
    let waktuTenggang = 3;
    try {
      const [settingRows] = await pool.execute<RowDataPacket[]>(
        'SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = "waktu_tenggang_absensi" LIMIT 1'
      );
      if (settingRows.length > 0 && settingRows[0].nilai) {
        const parsed = parseInt(settingRows[0].nilai);
        if (!isNaN(parsed) && parsed > 0) waktuTenggang = parsed;
      }
    } catch (_) {}

    // Generate signed quick token
    const quickPayload = {
      type: 'quick_absen',
      guru_id: guruInfo.guru_id,
      guru_nama: guruInfo.nama,
      user_id: guruInfo.user_id || null,
      jadwal_id: Number(jadwal_id),
      tipe,
      date: targetDate,
      role: 'guru',
      waktu_tenggang: waktuTenggang,
      createdAt: Date.now()
    };

    const quickToken = signToken(quickPayload, `${waktuTenggang}h`);
    const quickUrl = `https://app.ppmawar.or.id/absen/quick?token=${quickToken}`;

    return NextResponse.json({
      success: true,
      token: quickToken,
      url: quickUrl
    });
  } catch (error: any) {
    console.error('Error generating quick token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
