import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken, signToken } from '@/lib/auth/jwt';
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
    const { tipe, jadwal_id, status, keterangan, foto_bukti, guru_badal_id, guru_badal_nama } = body;

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

    // Resolve guru badal jika ada
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
    let reasonText = (keterangan || '').trim() || (validStatus === 'Sakit' ? 'Sakit (Melalui Dashboard)' : 'Izin (Melalui Dashboard)');
    if (badalGuru) {
      reasonText = `${reasonText} (Dibadal oleh Ust. ${badalGuru.nama})`;
    }

    // Waktu & Tanggal saat ini (Asia/Jakarta / WIB)
    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentTimeStr = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false });

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

    // Cek kolom foto_bukti & guru_badal_id
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
      const colList: string[] = ['guru_id', 'tanggal', 'status', 'keterangan', 'is_otomatis', 'waktu_absensi'];
      const valPlaceholders: string[] = ['?', '?', '?', '?', '0', '?'];
      const valList: any[] = [guruId, todayStr, validStatus, reasonText, currentTimeStr];

      if (tipe === 'madin') {
        colList.push('jadwal_madin_id');
        valPlaceholders.push('?');
        valList.push(jId);
      } else if (tipe === 'quran') {
        colList.push('jadwal_quran_id');
        valPlaceholders.push('?');
        valList.push(jId);
      } else if (tipe === 'kegiatan' || tipe === 'kamar') {
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
        guru_id: guruId, // Guru utama yang berhalangan
        guru_nama: guruNama,
        badal_id: badalGuru.guru_id || null,
        badal_nama: badalGuru.nama,
        jadwal_id: jId,
        tipe,
        date: todayStr,
        role: 'guru',
        waktu_tenggang: waktuTenggang,
        createdAt: Date.now()
      };
      badalToken = signToken(badalPayload, `${waktuTenggang}h`);
      badalUrl = `https://app.ppmawar.or.id/absen/quick?token=${badalToken}`;
    }

    return NextResponse.json({
      success: true,
      message: `Permohonan ${validStatus} untuk ${guruNama} berhasil dicatat.${badalGuru ? ` Guru pengganti: ${badalGuru.nama}` : ''}`,
      status: validStatus,
      guru_nama: guruNama,
      badal_info: badalGuru ? {
        id: badalGuru.guru_id,
        nama: badalGuru.nama,
        no_hp: badalGuru.no_hp
      } : null,
      badal_url: badalUrl,
      badal_token: badalToken
    });
  } catch (error: any) {
    console.error('Error submitting dashboard izin:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
