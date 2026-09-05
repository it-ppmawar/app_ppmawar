import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import QRCode from 'qrcode';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const id = searchParams.get('id');
    const format = searchParams.get('format') || 'png'; // 'png' or 'json'
    const download = searchParams.get('download') === 'true';

    let guru: any = null;

    if (token) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, nama, homebase, qr_token, nip FROM dewan_guru WHERE qr_token = ? LIMIT 1',
        [token]
      );
      if (rows && rows.length > 0) guru = rows[0];
    } else if (id) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, nama, homebase, qr_token, nip FROM dewan_guru WHERE id = ? LIMIT 1',
        [id]
      );
      if (rows && rows.length > 0) guru = rows[0];
    }

    if (!guru) {
      return NextResponse.json({ error: 'Data dewan guru tidak ditemukan.' }, { status: 404 });
    }

    // Buat URL absensi mandiri yang dapat dibuka browser atau dibaca oleh pemindai kamera
    const host = request.headers.get('host') || 'app.ppmawar.or.id';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const qrValue = `${proto}://${host}/absen/guru?token=${encodeURIComponent(guru.qr_token)}`;

    if (format === 'json') {
      const dataUrl = await QRCode.toDataURL(qrValue, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1e3a8a', // Dark blue / navy elegant
          light: '#ffffff'
        }
      });

      return NextResponse.json({
        success: true,
        guru: {
          id: guru.id,
          nama: guru.nama,
          homebase: guru.homebase,
          nip: guru.nip,
          qr_token: guru.qr_token
        },
        qrValue,
        dataUrl
      });
    }

    // Default: return raw PNG image
    const qrBuffer = await QRCode.toBuffer(qrValue, {
      width: 450,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const cleanName = (guru.nama || 'guru').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `QR_${guru.homebase || 'YPMA'}_${cleanName}.png`;

    return new NextResponse(new Uint8Array(qrBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {})
      }
    });
  } catch (error: any) {
    console.error('[dewan-guru-qr] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
