import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureDewanGuruDB } from '@/lib/ensureDewanGuruDB';

export async function GET(request: Request) {
  try {
    await ensureDewanGuruDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const hari = searchParams.get('hari');
    const homebase = searchParams.get('homebase');
    const tipe_jadwal = searchParams.get('tipe_jadwal');

    // Self-healing: pastikan tabel dan kolom jadwal_dewan_guru sudah ada
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS jadwal_dewan_guru (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nama_sesi VARCHAR(150) NOT NULL,
          homebase VARCHAR(100) DEFAULT 'SEMUA',
          tipe_jadwal ENUM('rutin', 'insidental') NOT NULL DEFAULT 'rutin',
          hari ENUM('Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu') NOT NULL,
          tanggal DATE DEFAULT NULL,
          jam_mulai TIME NOT NULL,
          jam_selesai TIME NOT NULL,
          toleransi_menit INT NOT NULL DEFAULT 15,
          keterangan TEXT DEFAULT NULL,
          aktif TINYINT(1) NOT NULL DEFAULT 1,
          created_by VARCHAR(100) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_jadwal_hari (hari),
          INDEX idx_jadwal_homebase (homebase),
          INDEX idx_jadwal_tipe (tipe_jadwal),
          INDEX idx_jadwal_tanggal (tanggal)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      try {
        await pool.execute(`ALTER TABLE jadwal_dewan_guru ADD COLUMN tipe_jadwal ENUM('rutin', 'insidental') NOT NULL DEFAULT 'rutin' AFTER homebase`);
      } catch {}
      try {
        await pool.execute(`ALTER TABLE jadwal_dewan_guru ADD COLUMN tanggal DATE DEFAULT NULL AFTER hari`);
      } catch {}
      try {
        await pool.execute(`ALTER TABLE jadwal_dewan_guru ADD INDEX idx_jadwal_tipe (tipe_jadwal)`);
      } catch {}
      try {
        await pool.execute(`ALTER TABLE jadwal_dewan_guru ADD INDEX idx_jadwal_tanggal (tanggal)`);
      } catch {}
    } catch (tblErr) {
      console.warn('[jadwal-dewan-guru] Table check warning:', tblErr);
    }

    let query = `SELECT * FROM jadwal_dewan_guru WHERE aktif = 1`;
    const params: any[] = [];

    if (tipe_jadwal && tipe_jadwal !== 'SEMUA') {
      if (tipe_jadwal === 'rutin') {
        query += ` AND (tipe_jadwal = 'rutin' OR tipe_jadwal IS NULL)`;
      } else {
        query += ` AND tipe_jadwal = ?`;
        params.push(tipe_jadwal);
      }
    }

    if (hari && hari !== 'SEMUA') {
      query += ` AND hari = ?`;
      params.push(hari);
    }

    if (homebase && homebase !== 'SEMUA') {
      query += ` AND (homebase = ? OR homebase = 'SEMUA')`;
      params.push(homebase);
    }

    query += ` ORDER BY 
      CASE WHEN tipe_jadwal = 'insidental' THEN 1 ELSE 0 END ASC,
      CASE WHEN tipe_jadwal = 'insidental' THEN tanggal ELSE NULL END DESC,
      FIELD(hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Ahad'), 
      jam_mulai ASC`;

    let [rows] = await pool.execute<RowDataPacket[]>(query, params);

    // Jika tabel kosong dan filter SEMUA, semai default hari kerja
    if (rows.length === 0 && (!hari || hari === 'SEMUA') && (!homebase || homebase === 'SEMUA') && (!tipe_jadwal || tipe_jadwal === 'SEMUA')) {
      try {
        await pool.execute(`
          INSERT INTO jadwal_dewan_guru (nama_sesi, homebase, tipe_jadwal, hari, jam_mulai, jam_selesai, toleransi_menit, keterangan, created_by)
          VALUES 
            ('KBM & Kehadiran Pagi (Senin)', 'SEMUA', 'rutin', 'Senin', '07:00:00', '13:30:00', 30, 'Jam Kerja & Mengajar Harian', 'System'),
            ('KBM & Kehadiran Pagi (Selasa)', 'SEMUA', 'rutin', 'Selasa', '07:00:00', '13:30:00', 30, 'Jam Kerja & Mengajar Harian', 'System'),
            ('KBM & Kehadiran Pagi (Rabu)', 'SEMUA', 'rutin', 'Rabu', '07:00:00', '13:30:00', 30, 'Jam Kerja & Mengajar Harian', 'System'),
            ('KBM & Kehadiran Pagi (Kamis)', 'SEMUA', 'rutin', 'Kamis', '07:00:00', '13:30:00', 30, 'Jam Kerja & Mengajar Harian', 'System'),
            ('KBM & Kehadiran Pagi (Sabtu)', 'SEMUA', 'rutin', 'Sabtu', '07:00:00', '13:30:00', 30, 'Jam Kerja & Mengajar Harian', 'System')
        `);
        const [reRows] = await pool.execute<RowDataPacket[]>(query, params);
        rows = reRows;
      } catch (seedErr) {
        console.warn('[jadwal-dewan-guru] Auto-seed warning:', seedErr);
      }
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('[jadwal-dewan-guru] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && payload.role !== 'staff' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Admin & Pengasuh yang dapat menambah jadwal.' }, { status: 403 });
    }

    const body = await request.json();
    const { nama_sesi, homebase, tipe_jadwal: rawTipe, hari: rawHari, tanggal, jam_mulai, jam_selesai, toleransi_menit, keterangan } = body;

    const tipe_jadwal = rawTipe === 'insidental' ? 'insidental' : 'rutin';

    let hari = rawHari;
    if (tipe_jadwal === 'insidental') {
      if (!tanggal) {
        return NextResponse.json({ error: 'Tanggal pelaksanaan wajib diisi untuk jadwal insidental / rapat.' }, { status: 400 });
      }
      // Hitung hari otomatis dari tanggal
      const d = new Date(tanggal + 'T00:00:00');
      const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      hari = days[d.getDay()];
    }

    if (!nama_sesi || !hari || !jam_mulai || !jam_selesai) {
      return NextResponse.json({ error: 'Nama sesi, hari/tanggal, jam mulai, dan jam selesai wajib diisi.' }, { status: 400 });
    }

    const [res]: any = await pool.execute(`
      INSERT INTO jadwal_dewan_guru (nama_sesi, homebase, tipe_jadwal, hari, tanggal, jam_mulai, jam_selesai, toleransi_menit, keterangan, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nama_sesi.trim(),
      homebase || 'SEMUA',
      tipe_jadwal,
      hari,
      tipe_jadwal === 'insidental' ? tanggal : null,
      jam_mulai,
      jam_selesai,
      toleransi_menit || 15,
      keterangan || null,
      payload.real_name || payload.username || 'Admin'
    ]);

    return NextResponse.json({ success: true, id: res.insertId, message: 'Jadwal dewan guru berhasil disimpan.' });
  } catch (error: any) {
    console.error('[jadwal-dewan-guru] POST error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && payload.role !== 'staff' && !isPengasuh) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, nama_sesi, homebase, tipe_jadwal: rawTipe, hari: rawHari, tanggal, jam_mulai, jam_selesai, toleransi_menit, keterangan, aktif } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID jadwal tidak disertakan.' }, { status: 400 });
    }

    let tipe_jadwal = rawTipe !== undefined ? (rawTipe === 'insidental' ? 'insidental' : 'rutin') : null;
    let hari = rawHari || null;
    let tgl = tanggal !== undefined ? tanggal : null;

    if (tipe_jadwal === 'insidental' && tgl) {
      const d = new Date(tgl + 'T00:00:00');
      const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      hari = days[d.getDay()];
    } else if (tipe_jadwal === 'rutin') {
      tgl = null;
    }

    await pool.execute(`
      UPDATE jadwal_dewan_guru
      SET nama_sesi = COALESCE(?, nama_sesi),
          homebase = COALESCE(?, homebase),
          tipe_jadwal = COALESCE(?, tipe_jadwal),
          hari = COALESCE(?, hari),
          tanggal = CASE WHEN ? = 1 THEN ? ELSE tanggal END,
          jam_mulai = COALESCE(?, jam_mulai),
          jam_selesai = COALESCE(?, jam_selesai),
          toleransi_menit = COALESCE(?, toleransi_menit),
          keterangan = ?,
          aktif = COALESCE(?, aktif)
      WHERE id = ?
    `, [
      nama_sesi ? nama_sesi.trim() : null,
      homebase || null,
      tipe_jadwal,
      hari,
      tanggal !== undefined || rawTipe === 'rutin' ? 1 : 0,
      tgl,
      jam_mulai || null,
      jam_selesai || null,
      toleransi_menit !== undefined ? toleransi_menit : null,
      keterangan !== undefined ? keterangan : null,
      aktif !== undefined ? (aktif ? 1 : 0) : null,
      id
    ]);

    return NextResponse.json({ success: true, message: 'Jadwal berhasil diperbarui.' });
  } catch (error: any) {
    console.error('[jadwal-dewan-guru] PUT error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const isPengasuh = payload.role === 'pengasuh' || payload.is_pengasuh || payload.isPengasuh;
    if (payload.role !== 'admin' && !isPengasuh) {
      return NextResponse.json({ error: 'Hanya Admin & Pengasuh yang dapat menghapus jadwal.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID jadwal tidak disertakan.' }, { status: 400 });

    await pool.execute('DELETE FROM jadwal_dewan_guru WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Jadwal berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
