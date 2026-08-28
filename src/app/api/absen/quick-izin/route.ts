import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { token, status, keterangan, foto_bukti } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 400 });
    }

    const payload = verifyToken(token) as any;
    if (!payload || payload.type !== 'quick_absen') {
      return NextResponse.json({ error: 'Token tidak valid atau sudah kadaluarsa' }, { status: 401 });
    }

    const { guru_id, guru_nama, jadwal_id, tipe, date } = payload;
    if (!guru_id) {
      return NextResponse.json({ error: 'ID Guru tidak valid di dalam token' }, { status: 400 });
    }

    const validStatus = (status === 'Sakit' || status === 'sakit') ? 'Sakit' : 'Izin';
    const reasonText = (keterangan || '').trim() || (validStatus === 'Sakit' ? 'Sakit (Melalui Link WA)' : 'Izin (Melalui Link WA)');

    // Waktu & Tanggal saat ini (Asia/Jakarta / WIB)
    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentTimeStr = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false });

    const targetDate = date || todayStr;
    if (targetDate !== todayStr) {
      return NextResponse.json({
        error: `Tautan izin ini untuk tanggal ${targetDate}, bukan hari ini (${todayStr}).`
      }, { status: 401 });
    }

    // Handle foto bukti jika dalam format base64
    let savedFotoPath: string | null = null;
    if (foto_bukti && typeof foto_bukti === 'string' && foto_bukti.startsWith('data:image')) {
      try {
        const matches = foto_bukti.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const fileName = `izin_guru_${guru_id}_${Date.now()}.${ext}`;
          const uploadDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(base64Data, 'base64'));
          savedFotoPath = fileName;
        }
      } catch (err: any) {
        console.warn('[quick-izin] Gagal menyimpan foto bukti:', err.message);
      }
    } else if (foto_bukti && typeof foto_bukti === 'string') {
      savedFotoPath = foto_bukti;
    }

    const jId = Number(jadwal_id) || null;

    // Cek apakah kolom foto_bukti ada di tabel absensi_guru
    let hasFotoCol = false;
    try {
      const [cols] = await pool.execute<RowDataPacket[]>(
        "SHOW COLUMNS FROM absensi_guru LIKE 'foto_bukti'"
      );
      hasFotoCol = cols.length > 0;
    } catch (_) {}

    // Cek apakah sudah ada record absensi guru untuk tanggal dan jadwal ini
    let existingQuery = 'SELECT absensi_id FROM absensi_guru WHERE guru_id = ? AND tanggal = ?';
    const queryParams: any[] = [guru_id, targetDate];

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
      // Update record yang ada
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
      // Insert record baru
      if (tipe === 'madin') {
        if (hasFotoCol) {
          await pool.execute(
            'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id, foto_bukti) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
            [guru_id, targetDate, validStatus, reasonText, currentTimeStr, jId, savedFotoPath]
          );
        } else {
          await pool.execute(
            'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_madin_id) VALUES (?, ?, ?, ?, 0, ?, ?)',
            [guru_id, targetDate, validStatus, reasonText, currentTimeStr, jId]
          );
        }
      } else if (tipe === 'quran') {
        if (hasFotoCol) {
          await pool.execute(
            'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id, foto_bukti) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
            [guru_id, targetDate, validStatus, reasonText, currentTimeStr, jId, savedFotoPath]
          );
        } else {
          await pool.execute(
            'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, jadwal_quran_id) VALUES (?, ?, ?, ?, 0, ?, ?)',
            [guru_id, targetDate, validStatus, reasonText, currentTimeStr, jId]
          );
        }
      } else {
        if (hasFotoCol) {
          await pool.execute(
            'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id, foto_bukti) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
            [guru_id, targetDate, validStatus, reasonText, currentTimeStr, jId, savedFotoPath]
          );
        } else {
          await pool.execute(
            'INSERT INTO absensi_guru (guru_id, tanggal, status, keterangan, is_otomatis, waktu_absensi, kegiatan_id) VALUES (?, ?, ?, ?, 0, ?, ?)',
            [guru_id, targetDate, validStatus, reasonText, currentTimeStr, jId]
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Permohonan ${validStatus} Ustadz/Ustadzah ${guru_nama || ''} berhasil dicatat dalam sistem.`,
      status: validStatus,
      keterangan: reasonText,
      tanggal: targetDate
    });

  } catch (error: any) {
    console.error('[quick-izin] Error:', error.message);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem: ' + error.message }, { status: 500 });
  }
}