import { NextResponse } from 'next/server';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { token, status, keterangan, foto_bukti, guru_badal_id, guru_badal_nama } = await request.json();

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

    // Resolve guru badal jika dipilih
    let badalGuru: any = null;
    const bId = guru_badal_id ? Number(guru_badal_id) : null;
    if (bId) {
      const [badalRows] = await pool.execute<RowDataPacket[]>(
        'SELECT guru_id, nama, no_hp FROM guru WHERE guru_id = ?',
        [bId]
      );
      if (badalRows.length > 0) {
        badalGuru = badalRows[0];
      }
    } else if (guru_badal_nama && typeof guru_badal_nama === 'string' && guru_badal_nama.trim()) {
      badalGuru = {
        guru_id: null,
        nama: guru_badal_nama.trim(),
        no_hp: null
      };
    }

    const validStatus = (status === 'Sakit' || status === 'sakit') ? 'Sakit' : 'Izin';
    let reasonText = (keterangan || '').trim() || (validStatus === 'Sakit' ? 'Sakit (Melalui Link WA)' : 'Izin (Melalui Link WA)');
    if (badalGuru) {
      reasonText = `${reasonText} (Dibadal oleh Ust. ${badalGuru.nama})`;
    }

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

    // Cek apakah kolom foto_bukti & guru_badal_id ada di tabel absensi_guru
    let hasFotoCol = false;
    let hasBadalCol = false;
    try {
      const [cols] = await pool.execute<RowDataPacket[]>(
        "SHOW COLUMNS FROM absensi_guru"
      );
      const colNames = (cols || []).map((c: any) => c.Field);
      hasFotoCol = colNames.includes('foto_bukti');
      hasBadalCol = colNames.includes('guru_badal_id');
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
      let setFields = 'status = ?, keterangan = ?, waktu_absensi = ?, is_otomatis = 0';
      const setVals: any[] = [validStatus, reasonText, currentTimeStr];

      if (hasFotoCol && savedFotoPath) {
        setFields += ', foto_bukti = ?';
        setVals.push(savedFotoPath);
      }
      if (hasBadalCol) {
        setFields += ', guru_badal_id = ?';
        setVals.push(bId || null);
      }

      setVals.push(absensiId);
      await pool.execute(`UPDATE absensi_guru SET ${setFields} WHERE absensi_id = ?`, setVals);
    } else {
      // Insert record baru
      const colList: string[] = ['guru_id', 'tanggal', 'status', 'keterangan', 'is_otomatis', 'waktu_absensi'];
      const valPlaceholders: string[] = ['?', '?', '?', '?', '0', '?'];
      const valList: any[] = [guru_id, targetDate, validStatus, reasonText, currentTimeStr];

      if (tipe === 'madin') {
        colList.push('jadwal_madin_id');
        valPlaceholders.push('?');
        valList.push(jId);
      } else if (tipe === 'quran') {
        colList.push('jadwal_quran_id');
        valPlaceholders.push('?');
        valList.push(jId);
      } else {
        colList.push('kegiatan_id');
        valPlaceholders.push('?');
        valList.push(jId);
      }

      if (hasFotoCol && savedFotoPath) {
        colList.push('foto_bukti');
        valPlaceholders.push('?');
        valList.push(savedFotoPath);
      }
      if (hasBadalCol && bId) {
        colList.push('guru_badal_id');
        valPlaceholders.push('?');
        valList.push(bId);
      }

      await pool.execute(
        `INSERT INTO absensi_guru (${colList.join(', ')}) VALUES (${valPlaceholders.join(', ')})`,
        valList
      );
    }

    // Generate quick token untuk Guru Badal jika ditunjuk
    let badalUrl: string | null = null;
    let badalToken: string | null = null;
    if (badalGuru) {
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

      const badalPayload: any = {
        type: 'quick_absen',
        guru_id: guru_id, // Guru utama yang berhalangan
        guru_nama: guru_nama,
        badal_id: badalGuru.guru_id || null,
        badal_nama: badalGuru.nama,
        jadwal_id: jId,
        tipe,
        date: targetDate,
        role: 'guru',
        waktu_tenggang: waktuTenggang,
        createdAt: Date.now()
      };
      badalToken = signToken(badalPayload, `${waktuTenggang}h`);
      badalUrl = `https://app.ppmawar.or.id/absen/quick?token=${badalToken}`;
    }

    return NextResponse.json({
      success: true,
      message: `Permohonan ${validStatus} Ustadz/Ustadzah ${guru_nama || ''} berhasil dicatat dalam sistem.${badalGuru ? ` Guru pengganti: ${badalGuru.nama}` : ''}`,
      status: validStatus,
      keterangan: reasonText,
      tanggal: targetDate,
      badal_info: badalGuru ? {
        id: badalGuru.guru_id,
        nama: badalGuru.nama,
        no_hp: badalGuru.no_hp
      } : null,
      badal_url: badalUrl,
      badal_token: badalToken
    });

  } catch (error: any) {
    console.error('[quick-izin] Error:', error.message);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem: ' + error.message }, { status: 500 });
  }
}