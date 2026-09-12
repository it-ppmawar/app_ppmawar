import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import crypto from 'crypto';
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
    const homebase = searchParams.get('homebase');
    const search = searchParams.get('search');
    const all = searchParams.get('all') === 'true';

    const userRole = (payload.role || '').toLowerCase();

    // Khusus role guru: Hanya tampilkan data QR Code miliknya sendiri
    if (userRole === 'guru') {
      let guruNama = '';
      let guruNip = '';
      let guruPhone = '';
      let userNama = '';
      let userName = payload.username || '';

      if (payload.guruId) {
        const [gRows]: any = await pool.execute('SELECT nama, nip, no_hp FROM guru WHERE guru_id = ? LIMIT 1', [payload.guruId]);
        if (gRows && gRows.length > 0) {
          guruNama = gRows[0].nama || '';
          guruNip = gRows[0].nip || '';
          guruPhone = gRows[0].no_hp || '';
        }
      }

      if (payload.userId) {
        const [uRows]: any = await pool.execute('SELECT nama, username FROM users WHERE id = ? LIMIT 1', [payload.userId]);
        if (uRows && uRows.length > 0) {
          userNama = uRows[0].nama || '';
          if (!userName) userName = uRows[0].username || '';
        }
      }

      // Kumpulan kandidat nama untuk dicocokkan
      const candidateNames = Array.from(new Set([guruNama, userNama, userName].filter(Boolean)));

      // Helper untuk membersihkan gelar dan normalisasi nama
      const normalizeTeacherName = (str: string): string => {
        if (!str) return '';
        return str
          .toLowerCase()
          .replace(/\b(ustadzah|ustadz|ust|kyai|k\.h|kh|habib|gus|ning|drs|dra|dr|prof|haji|hajjah|hj|h)\b\.?/gi, ' ')
          .replace(/\b(s\.pd\.i|s\.pd|s\.ag|s\.kom|s\.si|s\.e|s\.sos|s\.h|s\.th\.i|m\.pd\.i|m\.pd|m\.ag|m\.si|m\.e|m\.h|m\.hum|m\.th\.i|lc|apt|dipl)\b\.?/gi, ' ')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Helper meratakan pengulangan huruf konsonan (misal robbach -> robach, muhammad -> muhamad)
      const collapseLetters = (str: string): string => {
        return str.replace(/([a-z])\1+/g, '$1');
      };

      // Ambil seluruh dewan guru aktif untuk scoring komprehensif
      const [allDewan]: any = await pool.execute('SELECT * FROM dewan_guru WHERE aktif = 1');
      const dewanList: any[] = allDewan || [];

      let matchedRows: any[] = [];

      // 1. Pencocokan NIP
      if (guruNip && guruNip.trim()) {
        const cleanNip = guruNip.trim();
        const found = dewanList.filter(d => d.nip && d.nip.trim() === cleanNip);
        if (found.length > 0) matchedRows = found;
      }

      // 2. Pencocokan No HP (9 digit terakhir)
      if (matchedRows.length === 0 && guruPhone && guruPhone.trim().length >= 8) {
        const cleanPhone = guruPhone.replace(/[^0-9]/g, '').slice(-9);
        const found = dewanList.filter(d => {
          if (!d.no_hp) return false;
          const targetPhone = String(d.no_hp).replace(/[^0-9]/g, '').slice(-9);
          return targetPhone && targetPhone === cleanPhone;
        });
        if (found.length > 0) matchedRows = found;
      }

      // 3. Pencocokan Cerdas Berdasarkan Nama
      if (matchedRows.length === 0 && candidateNames.length > 0) {
        let bestMatch: any = null;
        let highestScore = 0;

        for (const dg of dewanList) {
          const rawDgName = (dg.nama || '').trim();
          const normDgName = normalizeTeacherName(rawDgName);
          const collapsedDgName = collapseLetters(normDgName);
          const dgTokens = normDgName.split(' ').filter(w => w.length >= 2);
          const collapsedDgTokens = collapsedDgName.split(' ').filter(w => w.length >= 2);

          for (const cand of candidateNames) {
            const rawCand = cand.trim();
            const normCand = normalizeTeacherName(rawCand);
            const collapsedCand = collapseLetters(normCand);
            const candTokens = normCand.split(' ').filter(w => w.length >= 2);
            const collapsedCandTokens = collapsedCand.split(' ').filter(w => w.length >= 2);

            let score = 0;

            // a. Exact raw match
            if (rawCand.toLowerCase() === rawDgName.toLowerCase()) {
              score = 1000;
            }
            // b. Exact normalized match
            else if (normCand.length >= 3 && normCand === normDgName) {
              score = 900;
            }
            // c. Exact collapsed letters match (e.g. "robbach wahabi" vs "robach wahabi")
            else if (collapsedCand.length >= 3 && collapsedCand === collapsedDgName) {
              score = 850;
            }
            // d. Token containment match (seluruh token penting terdapat di nama target)
            else if (candTokens.length > 0 && dgTokens.length > 0) {
              const matchedTokens = collapsedCandTokens.filter(t => collapsedDgTokens.some(dgt => dgt === t || dgt.includes(t) || t.includes(dgt)));
              if (matchedTokens.length === collapsedCandTokens.length && matchedTokens.length >= 2) {
                score = 700 + matchedTokens.length * 10;
              } else if (matchedTokens.length >= 2) {
                const ratio = matchedTokens.length / Math.max(collapsedCandTokens.length, collapsedDgTokens.length);
                if (ratio >= 0.5) score = Math.round(500 * ratio);
              }
            }
            // e. Substring match
            else if (collapsedCand.length >= 5 && (collapsedDgName.includes(collapsedCand) || collapsedCand.includes(collapsedDgName))) {
              score = 400;
            }

            if (score > highestScore) {
              highestScore = score;
              bestMatch = dg;
            }
          }
        }

        if (bestMatch && highestScore >= 250) {
          matchedRows = [bestMatch];
        }
      }

      return NextResponse.json({
        success: true,
        isPersonal: true,
        total: matchedRows.length,
        data: matchedRows,
        stats: []
      });
    }

    let query = `SELECT * FROM dewan_guru WHERE aktif = 1`;
    const params: any[] = [];

    if (homebase && homebase !== 'SEMUA') {
      query += ` AND homebase = ?`;
      params.push(homebase);
    }

    if (search) {
      query += ` AND (nama LIKE ? OR homebase LIKE ? OR no_hp LIKE ? OR nip LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY homebase ASC, nama ASC`;

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);

    // Ambil rekapitulasi homebase
    const [stats] = await pool.execute<RowDataPacket[]>(`
      SELECT homebase, COUNT(*) as count,
             SUM(CASE WHEN jenis_kelamin = 'L' THEN 1 ELSE 0 END) as count_l,
             SUM(CASE WHEN jenis_kelamin = 'P' THEN 1 ELSE 0 END) as count_p,
             SUM(CASE WHEN no_hp IS NOT NULL AND no_hp != '' THEN 1 ELSE 0 END) as count_hp
      FROM dewan_guru
      WHERE aktif = 1
      GROUP BY homebase
      ORDER BY count DESC
    `);

    return NextResponse.json({
      success: true,
      total: rows.length,
      data: rows,
      stats
    });
  } catch (error: any) {
    console.error('[dewan-guru] GET error:', error.message);
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
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const body = await request.json();
    const { nama, jenis_kelamin, homebase, no_hp, alamat, nip } = body;

    if (!nama || !nama.trim()) {
      return NextResponse.json({ error: 'Nama guru wajib diisi.' }, { status: 400 });
    }

    const qrToken = 'dg_' + crypto.randomBytes(12).toString('hex');
    const [res]: any = await pool.execute(`
      INSERT INTO dewan_guru (nip, nama, jenis_kelamin, homebase, no_hp, alamat, qr_token, aktif)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      nip || null,
      nama.trim(),
      jenis_kelamin === 'P' ? 'P' : 'L',
      homebase || 'YPMA',
      no_hp || null,
      alamat || null,
      qrToken
    ]);

    return NextResponse.json({
      success: true,
      id: res.insertId,
      qr_token: qrToken,
      message: 'Dewan guru berhasil ditambahkan.'
    });
  } catch (error: any) {
    console.error('[dewan-guru] POST error:', error.message);
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
    const { id, nama, jenis_kelamin, homebase, no_hp, alamat, nip, aktif } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID guru tidak disertakan.' }, { status: 400 });
    }

    await pool.execute(`
      UPDATE dewan_guru
      SET nama = COALESCE(?, nama),
          jenis_kelamin = COALESCE(?, jenis_kelamin),
          homebase = COALESCE(?, homebase),
          no_hp = ?,
          alamat = ?,
          nip = ?,
          aktif = COALESCE(?, aktif)
      WHERE id = ?
    `, [
      nama ? nama.trim() : null,
      jenis_kelamin ? (jenis_kelamin === 'P' ? 'P' : 'L') : null,
      homebase ? homebase.trim() : null,
      no_hp !== undefined ? no_hp : null,
      alamat !== undefined ? alamat : null,
      nip !== undefined ? nip : null,
      aktif !== undefined ? (aktif ? 1 : 0) : null,
      id
    ]);

    return NextResponse.json({ success: true, message: 'Data dewan guru berhasil diperbarui.' });
  } catch (error: any) {
    console.error('[dewan-guru] PUT error:', error.message);
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

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat menghapus guru.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID guru tidak disertakan.' }, { status: 400 });

    await pool.execute('DELETE FROM dewan_guru WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Data guru berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
