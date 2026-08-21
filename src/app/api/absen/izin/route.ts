import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role === 'wali_murid') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { role, userId } = payload;
    const body = await request.json();
    const { tipe, jadwal_id, status, keterangan, foto_bukti } = body;

    const jId = Number(jadwal_id);
    if (!tipe || !jId) {
      return NextResponse.json({ error: 'Data jadwal tidak lengkap' }, { status: 400 });
    }

    // Resolve guru_id
    let guruId = payload.guruId || null;
    let guruNama = payload.nama || payload.username || 'Guru/Pembina';

    if (!guruId) {
      // Cari guru_id dari tabel guru berdasarkan user_id
      const [guruByUser] = await pool.execute<RowDataPacket[]>(
        'SELECT guru_id, nama FROM guru WHERE user_id = ? LIMIT 1',
        [userId]
      );
      if (guruByUser.length > 0) {
        guruId = guruByUser[0].guru_id;
        guruNama = guruByUser[0].nama;
      }
    }

    // Jika user adalah admin/staff/pengurus dan tidak punya guruId pribadi, ambil guru_id dari jadwal terkait
    if (!guruId) {
      if (tipe === 'madin') {
        const [rows] = await pool.execute<RowDataPacket[]>(
          'SELECT j.guru_id, g.nama FROM jadwal_madin j LEFT JOIN guru g ON j.guru_id = g.guru_id WHERE j.jadwal_id = ? LIMIT 1',
          [jId]
        );
        if (rows.length > 0 && rows[0].guru_id) {
          guruId = rows[0].guru_id;
          guruNama = rows[0].nama || guruNama;
        }
      } else if (tipe === 'quran') {
        const [rows] = await pool.execute<RowDataPacket[]>(
          'SELECT j.guru_id, g.nama FROM jadwal_quran j LEFT JOIN guru g ON j.guru_id = g.guru_id WHERE j.id = ? LIMIT 1',
          [jId]
        );
        if (rows.length > 0 && rows[0].guru_id) {
          guruId = rows[0].guru_id;
          guruNama = rows[0].nama || guruNama;
        }
      } else if (tipe === 'kegiatan') {
        const [rows] = await pool.execute<RowDataPacket[]>(
          'SELECT j.guru_id, g.nama FROM jadwal_kegiatan j LEFT JOIN guru g ON j.guru_id = g.guru_id WHERE j.kegiatan_id = ? LIMIT 1',
          [jId]
        );
        if (rows.length > 0 && rows[0].guru_id) {
          guruId = rows[0].guru_id;
          guruNama = rows[0].nama || guruNama;
        }
      }
    }

    if (!guruId) {
      return NextResponse.json({ error: 'Guru atau Pembina untuk jadwal ini tidak ditemukan' }, { status: 400 });
    }

    const validStatus = (status === 'Sakit' || status === 'sakit') ? 'Sakit' : 'Izin';
    const reasonText = (keterangan || '').trim() || (validStatus === 'Sakit' ? 'Sakit (Melalui Dashboard)' : 'Izin (Melalui Dashboard)');

    // Waktu & Tanggal saat ini (Asia/Jakarta / WIB)
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    const nowLocal = new Date(Date.now() - tzOffset);
    const todayStr = nowLocal.toISOString().slice(0, 10);
    const currentTimeStr = nowLocal.toISOString().slice(11, 19);

    // Handle foto bukti jika format base64
    let savedFotoPath: string | null = null;
    if (foto_bukti && typeof foto_bukti === 'string' && foto_bukti.startsWith('data:image')) {
      try {
        const matches = foto_bukti.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const fileName = `izin_guru_${guruId}_${Date.now()}.${ext}`;
          const uploadDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(base64Data, 'base64'));
          savedFotoPath = fileName;
        }
      } catch (err: any) {
        console.warn('[absen-izin] Gagal menyimpan foto bukti:', err.message);
      }
    } else if (foto_bukti && typeof foto_bukti === 'string') {
      savedFotoPath = foto_bukti;
    }

    // Cek kolom foto_bukti
    let hasFotoCol = false;
    try {
      const [cols] = await pool.execute<RowDataPacket[]>(
        "SHOW COLUMNS FROM absensi_guru LIKE 'foto_bukti'"
      );
      hasFotoCol = cols.length > 0;
    } catch (_) {}

    // Cek apakah sudah ada record absensi_guru untuk guru, tanggal, dan jadwal ini
    let existingQuery = 'SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ?';
    const queryParams: any[] = [guruId, todayStr];

    if (tipe === 'madin' && jId) {
      existingQuery += ' AND (jadwal_madin_id = ? OR jadwal_madin_id IS NULL)';
      queryParams.push(jId);
    } else if (tipe === 'quran' && jId) {
      existingQuery += ' AND (jadwal_quran_id = ? OR jadwal_quran_id IS NULL)';
      queryParams.push(jId);
    } else if ((tipe === 'kegiatan' || tipe === 'kamar') && jId) {
      existingQuery += ' AND (kegiatan_id = ? OR kegiatan_id IS NULL)';
      queryParams.push(jId);
    }

    const [existingRows] = await pool.execute<RowDataPacket[]>(existingQuery, queryParams);

    if (existingRows.length > 0) {
      const absensiId = existingRows[0].absensi_id;
      if (hasFotoCol && savedFotoPath) {
        await pool.execute(
          'UPDATE absensi_guru SET status = ?, keterangan = ?, waktu_absensi = ?, is_otomatis = 0, foto_bukti = ? WHERE absensi_id = ?',
          [validStatus, reasonText, currentTimeStr, savedFotoPath, absensiId]
        );
      } else {
        await pool.execute(
          'UPDATE absensi_guru SET status = ?, keterangan = ?, waktu_absensi = ?, is_otomatis = 0 WHERE absensi_id = ?',
          [validStatus, reasonText, currentTimeStr, absensiId]
        );
      }
    } else {
      let insertQuery = '';
      const insertParams: any[] = [guruId, todayStr, validStatus, reasonText, currentTimeStr];

      if (tipe === 'madin') {
        if (hasFotoCol && savedFotoPath) {
          insertQuery = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id, foto_bukti) VALUES (?, ?, ?, ?, 0, ?, ?, ?)';
          insertParams.push(jId, savedFotoPath);
        } else {
          insertQuery = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id) VALUES (?, ?, ?, ?, 0, ?, ?)';
          insertParams.push(jId);
        }
      } else if (tipe === 'quran') {
        if (hasFotoCol && savedFotoPath) {
          insertQuery = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id, foto_bukti) VALUES (?, ?, ?, ?, 0, ?, ?, ?)';
          insertParams.push(jId, savedFotoPath);
        } else {
          insertQuery = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id) VALUES (?, ?, ?, ?, 0, ?, ?)';
          insertParams.push(jId);
        }
      } else if (tipe === 'kegiatan' || tipe === 'kamar') {
        if (hasFotoCol && savedFotoPath) {
          insertQuery = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id, foto_bukti) VALUES (?, ?, ?, ?, 0, ?, ?, ?)';
          insertParams.push(jId, savedFotoPath);
        } else {
          insertQuery = 'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id) VALUES (?, ?, ?, ?, 0, ?, ?)';
          insertParams.push(jId);
        }
      }

      await pool.execute(insertQuery, insertParams);
    }

    return NextResponse.json({
      success: true,
      message: `Permohonan ${validStatus} untuk ${guruNama} berhasil dicatat.`,
      status: validStatus,
      guru_nama: guruNama
    });
  } catch (error: any) {
    console.error('Error submitting dashboard izin:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
