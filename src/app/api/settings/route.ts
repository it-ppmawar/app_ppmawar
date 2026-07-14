import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || ((payload as any).role !== 'admin' && (payload as any).role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM pengaturan_absensi_otomatis');
    
    // Convert to key-value pairs
    const settings: Record<string, string> = {};
    rows.forEach(row => {
      settings[row.nama_pengaturan] = row.nilai;
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || ((payload as any).role !== 'admin' && (payload as any).role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { absensi_otomatis, waktu_tenggang, waktu_mulai, lat_pesantren, lng_pesantren, radius_absen, rutinitas_sinkronisasi, nomor_cs, mode_libur } = await request.json();

    if (nomor_cs !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['nomor_cs', nomor_cs.toString(), nomor_cs.toString()]
      );
    }

    if (absensi_otomatis !== undefined) {
      // Use REPLACE INTO or INSERT ... ON DUPLICATE KEY UPDATE just in case
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['absensi_otomatis_guru', absensi_otomatis ? '1' : '0', absensi_otomatis ? '1' : '0']
      );
    }

    if (mode_libur !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['mode_libur', mode_libur ? '1' : '0', mode_libur ? '1' : '0']
      );
    }

    if (waktu_tenggang !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['waktu_tenggang_absensi', waktu_tenggang.toString(), waktu_tenggang.toString()]
      );
    }

    if (waktu_mulai !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['waktu_mulai_absensi', waktu_mulai.toString(), waktu_mulai.toString()]
      );
    }

    if (lat_pesantren !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['lat_pesantren', lat_pesantren.toString(), lat_pesantren.toString()]
      );
    }

    if (lng_pesantren !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['lng_pesantren', lng_pesantren.toString(), lng_pesantren.toString()]
      );
    }

    if (radius_absen !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['radius_absen', radius_absen.toString(), radius_absen.toString()]
      );
    }

    if (rutinitas_sinkronisasi !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['rutinitas_sinkronisasi', rutinitas_sinkronisasi.toString(), rutinitas_sinkronisasi.toString()]
      );
    }

    return NextResponse.json({ success: true, message: 'Pengaturan berhasil disimpan' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
