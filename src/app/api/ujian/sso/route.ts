import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role, muridId, userId, nama } = payload;
    const { searchParams } = new URL(request.url);
    const quizbId = searchParams.get('quiz_id') || '';
    const mode = searchParams.get('mode') || 'exam';

    // Ambil detail santri
    let santriNis = '';
    let santriNama = nama || 'Santri';
    let santriKelas = '';

    if (muridId) {
      const [muridRows] = await pool.execute<RowDataPacket[]>(
        `SELECT m.nis, m.nama, km.nama_kelas 
         FROM murid m 
         LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id 
         WHERE m.murid_id = ? LIMIT 1`,
        [muridId]
      );
      if (muridRows.length > 0) {
        santriNis = muridRows[0].nis || '';
        santriNama = muridRows[0].nama || santriNama;
        santriKelas = muridRows[0].nama_kelas || '';
      }
    }

    // Ambil Secret Key untuk jembatan SSO
    let secretKey = process.env.QUIZB_WEBHOOK_SECRET || 'ppmawar-quizb-2026-secret';
    try {
      const [settingRows] = await pool.execute<RowDataPacket[]>(
        "SELECT setting_value FROM quizb_settings WHERE setting_key = 'secret_key' LIMIT 1"
      );
      if (settingRows.length > 0 && settingRows[0].setting_value) {
        secretKey = settingRows[0].setting_value;
      }
    } catch (e) {}

    // Buat Signature SSO (HMAC-SHA256)
    const timestamp = Math.floor(Date.now() / 1000);
    const dataToSign = `${santriNis}|${santriNama}|${timestamp}`;
    const hmacSignature = crypto
      .createHmac('sha256', secretKey)
      .update(dataToSign)
      .digest('hex');

    // Buat URL target QuizB
    const baseUrl = 'https://quizb.my.id';
    const targetHash = quizbId ? `#/play/${quizbId}` : '#/quizzes';

    // URL SSO yang disematkan ke iframe
    const ssoUrl = `${baseUrl}/api_sso.php?nis=${encodeURIComponent(santriNis)}&nama=${encodeURIComponent(santriNama)}&kelas=${encodeURIComponent(santriKelas)}&ts=${timestamp}&sig=${hmacSignature}&mode=${mode}&target=${encodeURIComponent(targetHash)}`;

    // Fallback direct URL jika SSO file belum di-upload di Rumahweb
    const directCleanUrl = `${baseUrl}/?embed=1${quizbId ? `&player_name=${encodeURIComponent(santriNama)}` : ''}${targetHash}`;

    return NextResponse.json({
      success: true,
      santri: {
        nama: santriNama,
        nis: santriNis,
        kelas: santriKelas,
      },
      sso_url: ssoUrl,
      direct_url: directCleanUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
