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
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tanggal = searchParams.get('tanggal') || new Date().toLocaleDateString('en-CA');
    const homebase = searchParams.get('homebase');
    const jadwalId = searchParams.get('jadwal_id');

    // Hari target (Ahad, Senin, dst)
    const d = new Date(tanggal + 'T00:00:00');
    const days = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hari = days[d.getDay()];

    // 1. Ambil jadwal dewan guru untuk hari ini
    let jadwalQuery = `SELECT * FROM jadwal_dewan_guru WHERE hari = ? AND aktif = 1`;
    const jadwalParams: any[] = [hari];
    if (homebase && homebase !== 'SEMUA') {
      jadwalQuery += ` AND (homebase = ? OR homebase = 'SEMUA')`;
      jadwalParams.push(homebase);
    }
    jadwalQuery += ` ORDER BY jam_mulai ASC`;
    const [jadwalRows] = await pool.execute<RowDataPacket[]>(jadwalQuery, jadwalParams);

    // 2. Ambil guru
    let guruQuery = `SELECT id, nip, nama, jenis_kelamin, homebase, no_hp, qr_token, foto FROM dewan_guru WHERE aktif = 1`;
    const guruParams: any[] = [];
    if (homebase && homebase !== 'SEMUA') {
      guruQuery += ` AND homebase = ?`;
      guruParams.push(homebase);
    }
    guruQuery += ` ORDER BY homebase ASC, nama ASC`;
    const [guruRows] = await pool.execute<RowDataPacket[]>(guruQuery, guruParams);

    // 3. Ambil absensi hari target
    let absensiQuery = `
      SELECT a.id as absensi_id, a.guru_id, a.jadwal_id, a.tanggal, a.jam_absen,
             a.status, a.metode, a.keterangan, a.dicatat_oleh
      FROM absensi_dewan_guru a
      WHERE a.tanggal = ?
    `;
    const absensiParams: any[] = [tanggal];
    if (jadwalId) {
      absensiQuery += ` AND a.jadwal_id = ?`;
      absensiParams.push(jadwalId);
    }
    const [absensiRows] = await pool.execute<RowDataPacket[]>(absensiQuery, absensiParams);

    // Map absensi ke guru
    const absensiMap = new Map<string, any>();
    for (const a of absensiRows) {
      // Key: guru_id + (jadwal_id ? _jadwal_id : '')
      const key = `${a.guru_id}_${a.jadwal_id || 0}`;
      absensiMap.set(key, a);
    }

    const data = (guruRows as any[]).map(guru => {
      // Cek status absensi untuk jadwalId spesifik atau sesi pertama hari ini
      const targetJadwalId = jadwalId ? parseInt(jadwalId, 10) : (jadwalRows[0]?.id || 0);
      const match = absensiMap.get(`${guru.id}_${targetJadwalId}`) ||
                    absensiMap.get(`${guru.id}_0`) ||
                    (absensiRows as any[]).find(a => a.guru_id === guru.id);

      return {
        ...guru,
        absensi_id: match?.absensi_id || null,
        jadwal_id: match?.jadwal_id || (targetJadwalId || null),
        status: match?.status || null,
        jam_absen: match?.jam_absen || null,
        metode: match?.metode || null,
        keterangan: match?.keterangan || null,
        dicatat_oleh: match?.dicatat_oleh || null,
      };
    });

    const total = data.length;
    const hadir = data.filter(g => g.status === 'Hadir').length;
    const izin = data.filter(g => g.status === 'Izin').length;
    const sakit = data.filter(g => g.status === 'Sakit').length;
    const alpha = data.filter(g => g.status === 'Alpha').length;
    const belum = total - (hadir + izin + sakit + alpha);

    return NextResponse.json({
      success: true,
      tanggal,
      hari,
      stats: { total, hadir, izin, sakit, alpha, belum },
      jadwalList: jadwalRows,
      data
    });
  } catch (error: any) {
    console.error('[absen-dewan-guru] GET error:', error.message);
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
      return NextResponse.json({ error: 'Akses ditolak. Hanya Admin & Pengasuh yang dapat menginput absensi.' }, { status: 403 });
    }

    const body = await request.json();
    const recordedBy = payload.real_name || payload.username || 'Admin';

    // 1. Kasus QR Scan
    if (body.qr_token) {
      const [guruRows]: any = await pool.execute('SELECT id, nama, homebase FROM dewan_guru WHERE qr_token = ? AND aktif = 1', [body.qr_token]);
      if (!guruRows || guruRows.length === 0) {
        return NextResponse.json({ error: 'Kartu QR tidak dikenali atau guru tidak aktif.' }, { status: 404 });
      }
      const guru = guruRows[0];
      const tanggal = body.tanggal || new Date().toLocaleDateString('en-CA');
      const nowTime = new Date().toTimeString().split(' ')[0];
      const status = body.status || 'Hadir';
      const jadwalId = body.jadwal_id || null;

      await pool.execute(`
        INSERT INTO absensi_dewan_guru (guru_id, jadwal_id, tanggal, jam_absen, status, metode, keterangan, dicatat_oleh)
        VALUES (?, ?, ?, ?, ?, 'QR_Scan', ?, ?)
        ON DUPLICATE KEY UPDATE
          jam_absen = VALUES(jam_absen),
          status = VALUES(status),
          metode = 'QR_Scan',
          keterangan = VALUES(keterangan),
          dicatat_oleh = VALUES(dicatat_oleh)
      `, [guru.id, jadwalId, tanggal, nowTime, status, body.keterangan || 'Presensi via Scan QR', recordedBy]);

      return NextResponse.json({
        success: true,
        guru: { id: guru.id, nama: guru.nama, homebase: guru.homebase },
        message: `Absensi ${guru.nama} berhasil dicatat (${status})!`
      });
    }

    // 2. Kasus Batch Absensi
    if (body.batch && Array.isArray(body.batch)) {
      const tanggal = body.tanggal || new Date().toLocaleDateString('en-CA');
      const nowTime = new Date().toTimeString().split(' ')[0];
      let affected = 0;

      for (const item of body.batch) {
        if (!item.guru_id) continue;
        const jId = item.jadwal_id !== undefined ? item.jadwal_id : (body.jadwal_id || null);
        const st = item.status || 'Hadir';
        const ket = item.keterangan || null;

        await pool.execute(`
          INSERT INTO absensi_dewan_guru (guru_id, jadwal_id, tanggal, jam_absen, status, metode, keterangan, dicatat_oleh)
          VALUES (?, ?, ?, ?, ?, 'Manual', ?, ?)
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            keterangan = VALUES(keterangan),
            dicatat_oleh = VALUES(dicatat_oleh)
        `, [item.guru_id, jId, tanggal, nowTime, st, ket, recordedBy]);
        affected++;
      }

      return NextResponse.json({
        success: true,
        affected,
        message: `Berhasil memperbarui absensi untuk ${affected} dewan guru.`
      });
    }

    // 3. Kasus Single Absensi
    const { guru_id, jadwal_id, tanggal, status, keterangan } = body;
    if (!guru_id) {
      return NextResponse.json({ error: 'guru_id wajib disertakan.' }, { status: 400 });
    }

    const tgl = tanggal || new Date().toLocaleDateString('en-CA');
    const nowTime = new Date().toTimeString().split(' ')[0];
    const st = status || 'Hadir';

    await pool.execute(`
      INSERT INTO absensi_dewan_guru (guru_id, jadwal_id, tanggal, jam_absen, status, metode, keterangan, dicatat_oleh)
      VALUES (?, ?, ?, ?, ?, 'Manual', ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        keterangan = VALUES(keterangan),
        dicatat_oleh = VALUES(dicatat_oleh)
    `, [guru_id, jadwal_id || null, tgl, nowTime, st, keterangan || null, recordedBy]);

    return NextResponse.json({ success: true, message: 'Absensi berhasil disimpan.' });
  } catch (error: any) {
    console.error('[absen-dewan-guru] POST error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
