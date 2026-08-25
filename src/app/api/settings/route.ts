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

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const isAdmin = payload.role === 'admin';
    const { searchParams } = new URL(request.url);
    const publicOnly = searchParams.get('public') === '1';

    // Non-admin hanya boleh baca setting jeda panggilan (untuk keperluan UI)
    if (!isAdmin && !publicOnly) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAdmin && publicOnly) {
      // Kembalikan setting panggilan & lokasi publik
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN ('jeda_panggilan_wali', 'jeda_panggilan_pengurus', 'lat_pesantren', 'lng_pesantren', 'radius_absen', 'radius_panggilan_wali')"
      );
      const settings: Record<string, string> = {};
      rows.forEach((row: any) => { settings[row.nama_pengaturan] = row.nilai; });
      return NextResponse.json({ success: true, data: settings });
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
    if (!payload || (payload as any).role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Admin Utama yang dapat mengubah pengaturan sistem' }, { status: 403 });
    }

    const { 
      absensi_otomatis, 
      absensi_otomatis_madin,
      absensi_otomatis_quran,
      absensi_otomatis_kegiatan,
      waktu_tenggang, 
      waktu_mulai, 
      lat_pesantren, 
      lng_pesantren, 
      radius_absen, 
      rutinitas_sinkronisasi, 
      nomor_cs, 
      mode_libur,
      wa_scheduler_api_key,
      wa_scheduler_endpoint,
      wa_scheduler_lead_time,
      wa_scheduler_is_loop,
      jeda_panggilan_wali,
      jeda_panggilan_pengurus,
      radius_panggilan_wali
    } = await request.json();

    if (wa_scheduler_api_key !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        ['wa_scheduler_api_key', wa_scheduler_api_key.toString().trim(), wa_scheduler_api_key.toString().trim()]
      );
    }

    if (wa_scheduler_endpoint !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        ['wa_scheduler_endpoint', wa_scheduler_endpoint.toString().trim(), wa_scheduler_endpoint.toString().trim()]
      );
    }

    if (wa_scheduler_lead_time !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        ['wa_scheduler_lead_time', wa_scheduler_lead_time.toString().trim(), wa_scheduler_lead_time.toString().trim()]
      );
    }

    if (wa_scheduler_is_loop !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        ['wa_scheduler_is_loop', wa_scheduler_is_loop ? '1' : '0', wa_scheduler_is_loop ? '1' : '0']
      );
    }

    if (nomor_cs !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['nomor_cs', nomor_cs.toString(), nomor_cs.toString()]
      );
    }

    if (absensi_otomatis !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['absensi_otomatis_guru', absensi_otomatis ? '1' : '0', absensi_otomatis ? '1' : '0']
      );
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['absensi_otomatis', absensi_otomatis ? '1' : '0', absensi_otomatis ? '1' : '0']
      );
    }

    if (absensi_otomatis_madin !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['absensi_otomatis_madin', absensi_otomatis_madin ? '1' : '0', absensi_otomatis_madin ? '1' : '0']
      );
    }

    if (absensi_otomatis_quran !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['absensi_otomatis_quran', absensi_otomatis_quran ? '1' : '0', absensi_otomatis_quran ? '1' : '0']
      );
    }

    if (absensi_otomatis_kegiatan !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['absensi_otomatis_kegiatan', absensi_otomatis_kegiatan ? '1' : '0', absensi_otomatis_kegiatan ? '1' : '0']
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
      const cleanLat = lat_pesantren.toString().replace(',', '.').trim();
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['lat_pesantren', cleanLat, cleanLat]
      );
    }

    if (lng_pesantren !== undefined) {
      const cleanLng = lng_pesantren.toString().replace(',', '.').trim();
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['lng_pesantren', cleanLng, cleanLng]
      );
    }

    if (radius_absen !== undefined) {
      const cleanRadius = radius_absen.toString().replace(',', '.').trim();
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['radius_absen', cleanRadius, cleanRadius]
      );
    }

    if (rutinitas_sinkronisasi !== undefined) {
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?', 
        ['rutinitas_sinkronisasi', rutinitas_sinkronisasi.toString(), rutinitas_sinkronisasi.toString()]
      );
    }

    if (jeda_panggilan_wali !== undefined) {
      const val = Math.max(0, parseInt(jeda_panggilan_wali) || 0).toString();
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        ['jeda_panggilan_wali', val, val]
      );
    }

    if (jeda_panggilan_pengurus !== undefined) {
      const val = Math.max(0, parseInt(jeda_panggilan_pengurus) || 0).toString();
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        ['jeda_panggilan_pengurus', val, val]
      );
    }

    if (radius_panggilan_wali !== undefined) {
      const val = radius_panggilan_wali ? '1' : '0';
      await pool.execute(
        'INSERT INTO pengaturan_absensi_otomatis (nama_pengaturan, nilai) VALUES (?, ?) ON DUPLICATE KEY UPDATE nilai = ?',
        ['radius_panggilan_wali', val, val]
      );
    }

    return NextResponse.json({ success: true, message: 'Pengaturan berhasil disimpan' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
