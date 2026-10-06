import { NextResponse, NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ensureKuponMakanDB, detectActiveSesiWIB } from '@/lib/ensureKuponMakanDB';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { resolveAsrama } from '@/lib/auth/resolveAsrama';

export const dynamic = 'force-dynamic';

async function checkAuth(customAllowedRoles?: string[]) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { ok: false, status: 401, error: 'Unauthorized: Silakan login terlebih dahulu.' };

  const payload = verifyToken(token) as any;
  if (!payload) return { ok: false, status: 401, error: 'Token invalid.' };

  const userId = payload.userId || payload.id;
  let role = (payload.role || '').toLowerCase();
  let isPengasuhOrPengurus = !!(
    payload.isPengasuh ||
    payload.is_pengasuh ||
    payload.isPengurusAsrama ||
    payload.is_pengurus_asrama ||
    role.includes('pengasuh') ||
    role.includes('pengurus')
  );

  if (userId) {
    try {
      const [uRows] = await pool.execute<RowDataPacket[]>('SELECT role, is_pengasuh, is_pengurus_asrama FROM users WHERE id = ? LIMIT 1', [userId]);
      if (uRows.length > 0) {
        const dbRole = (uRows[0].role || '').toLowerCase();
        if (dbRole) role = dbRole;
        if (uRows[0].is_pengasuh || dbRole.includes('pengasuh')) isPengasuhOrPengurus = true;
        if (uRows[0].is_pengurus_asrama || dbRole.includes('pengurus')) isPengasuhOrPengurus = true;
      }
    } catch (_) {}
  }

  const isMurniGuru = role === 'guru' && !isPengasuhOrPengurus;
  const allowed = customAllowedRoles || ['admin', 'staff', 'pengurus_asrama', 'pengasuh', 'pengurus'];
  const isAllowed = (allowed.includes(role) || isPengasuhOrPengurus) && !isMurniGuru;

  if (!isAllowed) {
    return { ok: false, status: 403, error: 'Akses ditolak: Akun Anda tidak memiliki izin mengakses data kupon makan.' };
  }

  return { ok: true, payload, role, isPengasuhOrPengurus, userId };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAuth();
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await ensureKuponMakanDB();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('tanggal');
    const asramaParam = searchParams.get('asrama'); // e.g. 'Semua', 'Asrama A', 'Asrama B', ...

    // --- Resolve asrama user (RBAC) ---
    const { payload, role, isPengasuhOrPengurus, userId } = auth as any;
    const canSwitchAsrama = ['admin', 'staff'].includes(role);

    // Resolve user's bound asrama (if any)
    let userAsrama: string | null = null;
    if (!canSwitchAsrama) {
      userAsrama = await resolveAsrama(
        userId,
        role,
        payload.username || '',
        payload.asrama || payload.namaAsrama || null
      );
    }

    // Active asrama filter: forced for non-admin/staff, chosen by admin/staff
    let activeAsrama: string | null = null;
    if (!canSwitchAsrama) {
      // Pengurus/Pengasuh: always use their own asrama
      activeAsrama = userAsrama;
    } else {
      // Admin/Staff: use requested param, default to 'Semua'
      activeAsrama = asramaParam && asramaParam !== 'Semua' ? asramaParam : null;
    }

    // Build asrama SQL condition for riwayat_makan & murid queries
    // riwayat_makan has `asrama` column directly, murid joins kamar
    const asramaLetterFromName = (name: string | null): string | null => {
      if (!name) return null;
      const m = name.match(/asrama\s+([a-z0-9]+)/i);
      if (m) return m[1].toUpperCase();
      return name.toUpperCase();
    };

    const activeAsramaLetter = asramaLetterFromName(activeAsrama);

    // Condition for riwayat_makan table (has `asrama` column like 'Asrama A' or 'A')
    const buildRiwayatAsramaCond = (): [string, any[]] => {
      if (!activeAsramaLetter) return ['1=1', []];
      const fullName = activeAsramaLetter.toLowerCase() === 'tahfid'
        ? 'Asrama Tahfid'
        : `Asrama ${activeAsramaLetter}`;
      return [
        `(r.asrama = ? OR r.asrama = ? OR r.asrama LIKE ?)`,
        [fullName, activeAsramaLetter, `Asrama ${activeAsramaLetter}%`]
      ];
    };

    const nowWib = new Date();
    const today = dateParam || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(nowWib);
    const { activeKode, activeNama, sessions } = await detectActiveSesiWIB();

    const [riwayatCond, riwayatParams] = buildRiwayatAsramaCond();

    // 1. Ambil ringkasan statistik hari ini (dengan filter asrama)
    const [summaryRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_scans,
        SUM(CASE WHEN status IN ('berhasil', 'dispensasi') THEN 1 ELSE 0 END) as total_porsi,
        SUM(CASE WHEN status = 'berhasil' THEN 1 ELSE 0 END) as total_berhasil,
        SUM(CASE WHEN status = 'dispensasi' THEN 1 ELSE 0 END) as total_dispensasi,
        SUM(CASE WHEN status = 'ditolak' THEN 1 ELSE 0 END) as total_ditolak
       FROM riwayat_makan r
       WHERE tanggal = ? AND ${riwayatCond}`,
      [today, ...riwayatParams]
    );

    // Rincian porsi per sesi (dengan filter asrama)
    const [sesiCounts] = await pool.query<RowDataPacket[]>(
      `SELECT sesi, COUNT(*) as porsi
       FROM riwayat_makan r
       WHERE tanggal = ? AND status IN ('berhasil', 'dispensasi') AND ${riwayatCond}
       GROUP BY sesi`,
      [today, ...riwayatParams]
    );

    const porsiPerSesi: Record<string, number> = {};
    for (const sc of sesiCounts) {
      porsiPerSesi[sc.sesi] = Number(sc.porsi || 0);
    }

    const stats = summaryRows[0] || {
      total_scans: 0,
      total_porsi: 0,
      total_berhasil: 0,
      total_dispensasi: 0,
      total_ditolak: 0
    };

    // 2. Hitung kuota santri lunas syahriyah bulan lalu (tidak ada tunggakan syahriyah 'Belum')
    let totalSantriLunas = 0;
    try {
      // Build asrama condition for murid/kamar tables
      let muridAsramaCond = '1=1';
      let muridAsramaParams: any[] = [];

      if (activeAsramaLetter) {
        const fullName = activeAsramaLetter.toLowerCase() === 'tahfid'
          ? 'Asrama Tahfid'
          : `Asrama ${activeAsramaLetter}`;
        muridAsramaCond = `(k.nama_asrama = ? OR k.nama_asrama = ? OR k.nama_asrama LIKE ?)`;
        muridAsramaParams = [fullName, activeAsramaLetter, `Asrama ${activeAsramaLetter}%`];
      }

      const [lunasRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT m.murid_id) as total_lunas
         FROM murid m
         LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
         WHERE m.status = 'aktif'
           AND ${muridAsramaCond}
           AND m.nis NOT IN (
             SELECT DISTINCT b.nis
             FROM billing b
             WHERE b.status = 'Belum'
               AND b.nominal > 0
               AND b.kategori = 'pesantren'
               AND (b.nama_tagihan LIKE '%Syahriyah%' OR b.nama_tagihan LIKE '%syahriyah%')
           )`,
        [...muridAsramaParams]
      );
      totalSantriLunas = Number(lunasRows[0]?.total_lunas || 0);
    } catch (e) {
      // Fallback jika tabel billing/kamar belum lengkap
      console.warn('totalSantriLunas query failed:', e);
      totalSantriLunas = 0;
    }

    // 3. Ambil 30 scan terakhir (dengan filter asrama)
    const [recentRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*, m.foto
       FROM riwayat_makan r
       LEFT JOIN murid m ON r.murid_id = m.murid_id
       WHERE r.tanggal = ? AND ${riwayatCond}
       ORDER BY r.id DESC
       LIMIT 30`,
      [today, ...riwayatParams]
    );

    // 4. Ambil setting sistem
    const [settingRows] = await pool.query<RowDataPacket[]>(
      `SELECT nama_pengaturan, nilai, keterangan FROM pengaturan_kupon_makan`
    );
    const settings: Record<string, string> = {};
    for (const s of settingRows) {
      settings[s.nama_pengaturan] = s.nilai;
    }

    return NextResponse.json({
      success: true,
      tanggal: today,
      activeSesi: activeKode,
      activeNama,
      sessions,
      porsiPerSesi,
      stats: {
        totalScans: Number(stats.total_scans || 0),
        totalPorsi: Number(stats.total_porsi || 0),
        totalBerhasil: Number(stats.total_berhasil || 0),
        totalDispensasi: Number(stats.total_dispensasi || 0),
        totalDitolak: Number(stats.total_ditolak || 0)
      },
      totalSantriLunas,
      userAsrama,
      canSwitchAsrama,
      activeAsrama: activeAsrama || 'Semua',
      recentScans: recentRows,
      settings
    });

  } catch (error: any) {
    console.error('Error in GET /api/kupon-makan/stats:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Batal / Hapus Scan jika keliru (Hanya admin, staff, pengasuh, pengurus_asrama)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await checkAuth(['admin', 'staff', 'pengasuh', 'pengurus_asrama']);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID scan wajib disertakan.' }, { status: 400 });
    }

    await pool.query<ResultSetHeader>('DELETE FROM riwayat_makan WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Catatan scan berhasil dibatalkan.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Update pengaturan (misal toggle Mode Uji Coba)
export async function PUT(request: NextRequest) {
  try {
    const auth = await checkAuth(['admin', 'staff', 'pengasuh', 'pengurus_asrama']);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ success: false, message: 'Nama pengaturan wajib diisi.' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO pengaturan_kupon_makan (nama_pengaturan, nilai) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
      [key, String(value)]
    );

    return NextResponse.json({ success: true, message: 'Pengaturan berhasil diperbarui.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
