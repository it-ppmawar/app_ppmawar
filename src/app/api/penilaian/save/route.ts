import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { resolvePenilaianAuth } from '@/lib/auth/penilaianAuth';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';

export const dynamic = 'force-dynamic';

const isEmptyVal = (v: any) => v === null || v === undefined || String(v).trim() === '';

async function getGuruScope(guruId: number | string) {
  const [waliRows] = await pool.execute<RowDataPacket[]>(
    'SELECT kelas_id FROM kelas_madin WHERE guru_id = ?',
    [guruId]
  );
  const waliKelasIds = new Set<number>(waliRows.map(r => Number(r.kelas_id)));

  const [jadwalRows] = await pool.execute<RowDataPacket[]>(
    'SELECT kelas_madin_id, mata_pelajaran FROM jadwal_madin WHERE guru_id = ?',
    [guruId]
  );
  const taughtKelasIds = new Set<number>();
  const taughtMapelSet = new Set<string>();
  jadwalRows.forEach(r => {
    const kId = Number(r.kelas_madin_id);
    if (kId) taughtKelasIds.add(kId);
    const m = String(r.mata_pelajaran || '').trim().toLowerCase();
    if (kId && m) taughtMapelSet.add(`${kId}::${m}`);
  });

  return { waliKelasIds, taughtKelasIds, taughtMapelSet };
}

async function canGuruModifyMapel(
  guruId: number | string,
  kelasId: number | null,
  mapel: string,
  scope: Awaited<ReturnType<typeof getGuruScope>>
): Promise<boolean> {
  if (!kelasId) return false;
  if (scope.waliKelasIds.has(kelasId)) return true;
  if (!scope.taughtKelasIds.has(kelasId)) return false;

  const mapelLower = String(mapel || '').trim().toLowerCase();
  if (!mapelLower) return false;
  if (scope.taughtMapelSet.has(`${kelasId}::${mapelLower}`)) return true;

  // Untuk "Mapel Khusus": izinkan selama mapel tersebut tidak sedang diampu guru lain di kelas yang sama
  const [otherRows] = await pool.execute<RowDataPacket[]>(
    'SELECT guru_id FROM jadwal_madin WHERE kelas_madin_id = ? AND LOWER(TRIM(mata_pelajaran)) = ? LIMIT 1',
    [kelasId, mapelLower]
  );
  if (otherRows.length === 0) return true;
  return Number(otherRows[0].guru_id) === Number(guruId);
}

export async function POST(request: Request) {
  try {
    await ensurePenilaianDB();

    const body = await request.json();
    const auth = await resolvePenilaianAuth(request, {
      bodyToken: body?.token,
      allowedRoles: ['admin', 'staff', 'guru'],
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { role, guruId, userId } = auth;
    const { kelas_id, mata_pelajaran, kitab, semester, tahun_ajaran, kurikulum_id, scores } = body;

    if (!kelas_id || !mata_pelajaran || !semester || !tahun_ajaran || !Array.isArray(scores)) {
      return NextResponse.json({ error: 'Data penilaian tidak lengkap' }, { status: 400 });
    }

    if (mata_pelajaran === 'SEMUA' || mata_pelajaran === 'Semua Mapel') {
      return NextResponse.json({ error: 'Silakan pilih salah satu mata pelajaran spesifik untuk menyimpan nilai.' }, { status: 400 });
    }

    const guruScope = role === 'guru' && guruId ? await getGuruScope(guruId) : null;

    // RBAC: Jika guru menyimpan untuk kelas tertentu, pastikan ia mengampu mapel atau wali kelas tersebut
    if (role === 'guru') {
      if (!guruId || !guruScope) {
        return NextResponse.json({ error: 'Identitas pengajar tidak ditemukan.' }, { status: 403 });
      }
      if (kelas_id !== 'SEMUA' && kelas_id !== 'all') {
        const kNum = Number(kelas_id);
        const allowed = await canGuruModifyMapel(guruId, kNum, mata_pelajaran, guruScope);
        if (!allowed) {
          return NextResponse.json({ error: 'Anda tidak memiliki wewenang menginput nilai pada kelas atau mata pelajaran ini.' }, { status: 403 });
        }
      }
    }

    const calcPredikat = (score: number) => {
      if (score >= 90) return 'A';
      if (score >= 80) return 'B';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'E';
    };

    let savedCount = 0;

    // Upsert setiap nilai dengan dukungan manual override dari guru
    for (const item of scores) {
      if (!item.murid_id) continue;

      // Lewati baris yang benar-benar belum diisi sama sekali agar tidak menuliskan nilai 0/E palsu
      if (
        isEmptyVal(item.nilai_harian) &&
        isEmptyVal(item.nilai_uts) &&
        isEmptyVal(item.nilai_uas) &&
        isEmptyVal(item.nilai_akhir) &&
        isEmptyVal(item.catatan)
      ) {
        continue;
      }

      const rawH = !isEmptyVal(item.nilai_harian) ? Number(item.nilai_harian) : 0;
      const rawU = !isEmptyVal(item.nilai_uts) ? Number(item.nilai_uts) : 0;
      const rawA = !isEmptyVal(item.nilai_uas) ? Number(item.nilai_uas) : 0;
      const harian = isNaN(rawH) ? 0 : Math.min(Math.max(rawH, 0), 100);
      const uts = isNaN(rawU) ? 0 : Math.min(Math.max(rawU, 0), 100);
      const uas = isNaN(rawA) ? 0 : Math.min(Math.max(rawA, 0), 100);

      // Fleksibilitas: Jika pengguna/guru mengisi atau mengubah nilai_akhir secara manual, gunakan nilai manual tersebut.
      // Jika tidak diisi manual, gunakan kalkulasi otomatis 30% Harian + 30% UTS + 40% UAS.
      let nilaiAkhir = 0;
      if (!isEmptyVal(item.nilai_akhir)) {
        const rawAkh = Number(item.nilai_akhir);
        nilaiAkhir = isNaN(rawAkh) ? 0 : Math.min(Math.max(rawAkh, 0), 100);
      } else if (!isEmptyVal(item.nilai_harian) || !isEmptyVal(item.nilai_uts) || !isEmptyVal(item.nilai_uas)) {
        nilaiAkhir = Math.round((harian * 0.3 + uts * 0.3 + uas * 0.4) * 100) / 100;
      }

      // Predikat: gunakan predikat yang diubah manual guru jika ada, atau hitung otomatis
      const predikat = item.predikat ? String(item.predikat).trim().toUpperCase() : calcPredikat(nilaiAkhir);

      const targetKelasId = (kelas_id === 'SEMUA' || kelas_id === 'all')
        ? (item.kelas_madin_id || null)
        : kelas_id;

      // RBAC tambahan saat kelas_id === 'SEMUA'
      if (role === 'guru' && guruId && guruScope && (kelas_id === 'SEMUA' || kelas_id === 'all')) {
        let resolvedKId = targetKelasId ? Number(targetKelasId) : null;
        if (!resolvedKId) {
          const [mRows] = await pool.execute<RowDataPacket[]>(
            'SELECT kelas_madin_id, kelas_madin_2_id FROM murid WHERE murid_id = ? LIMIT 1',
            [item.murid_id]
          );
          if (mRows.length > 0) {
            const k1 = Number(mRows[0].kelas_madin_id || 0);
            const k2 = Number(mRows[0].kelas_madin_2_id || 0);
            if (k1 && (guruScope.waliKelasIds.has(k1) || guruScope.taughtKelasIds.has(k1))) resolvedKId = k1;
            else if (k2 && (guruScope.waliKelasIds.has(k2) || guruScope.taughtKelasIds.has(k2))) resolvedKId = k2;
          }
        }
        const allowed = await canGuruModifyMapel(guruId, resolvedKId, mata_pelajaran, guruScope);
        if (!allowed) {
          return NextResponse.json({ error: 'Anda tidak memiliki wewenang menginput nilai pada kelas/mapel santri ini.' }, { status: 403 });
        }
      }

      await pool.execute(`
        INSERT INTO nilai_santri 
          (murid_id, kelas_madin_id, kurikulum_id, mata_pelajaran, kitab, semester, tahun_ajaran, nilai_harian, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan, guru_id)
        VALUES (?, COALESCE(?, (SELECT kelas_madin_id FROM murid WHERE murid_id = ? LIMIT 1)), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          kelas_madin_id = VALUES(kelas_madin_id),
          kurikulum_id = VALUES(kurikulum_id),
          kitab = VALUES(kitab),
          nilai_harian = VALUES(nilai_harian),
          nilai_uts = VALUES(nilai_uts),
          nilai_uas = VALUES(nilai_uas),
          nilai_akhir = VALUES(nilai_akhir),
          predikat = VALUES(predikat),
          catatan = VALUES(catatan),
          guru_id = VALUES(guru_id),
          updated_at = CURRENT_TIMESTAMP
      `, [
        item.murid_id,
        targetKelasId,
        item.murid_id,
        kurikulum_id || null,
        mata_pelajaran,
        kitab || null,
        semester,
        tahun_ajaran,
        harian,
        uts,
        uas,
        nilaiAkhir,
        predikat,
        item.catatan || null,
        guruId || userId || null
      ]);
      savedCount++;
    }

    return NextResponse.json({
      success: true,
      savedCount,
      message: savedCount > 0
        ? `Berhasil menyimpan nilai untuk ${savedCount} santri.`
        : 'Tidak ada perubahan nilai yang terisi untuk disimpan.',
    });
  } catch (error: any) {
    console.error('Error in /api/penilaian/save:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensurePenilaianDB();

    const auth = await resolvePenilaianAuth(request, {
      allowedRoles: ['admin', 'staff', 'guru'],
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { role, guruId } = auth;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const muridId = searchParams.get('murid_id');
    const mapel = searchParams.get('mapel');
    const semester = searchParams.get('semester') || '1';
    const tahunAjaran = searchParams.get('tahun_ajaran') || '2025/2026';

    const guruScope = role === 'guru' && guruId ? await getGuruScope(guruId) : null;
    if (role === 'guru' && (!guruId || !guruScope)) {
      return NextResponse.json({ error: 'Identitas pengajar tidak ditemukan.' }, { status: 403 });
    }

    if (id) {
      if (role === 'guru' && guruId && guruScope) {
        const [rows] = await pool.execute<RowDataPacket[]>(
          'SELECT id, kelas_madin_id, mata_pelajaran FROM nilai_santri WHERE id = ? LIMIT 1',
          [id]
        );
        if (rows.length > 0) {
          const allowed = await canGuruModifyMapel(guruId, Number(rows[0].kelas_madin_id || 0), rows[0].mata_pelajaran, guruScope);
          if (!allowed) {
            return NextResponse.json({ error: 'Anda tidak memiliki wewenang menghapus nilai mata pelajaran ini.' }, { status: 403 });
          }
        }
      }
      await pool.execute('DELETE FROM nilai_santri WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: 'Nilai berhasil dihapus' });
    }

    if (!muridId) {
      return NextResponse.json({ error: 'Parameter murid_id atau id diperlukan' }, { status: 400 });
    }

    let muridKelasIds: number[] = [];
    if (role === 'guru' && guruId && guruScope) {
      const [mRows] = await pool.execute<RowDataPacket[]>(
        'SELECT kelas_madin_id, kelas_madin_2_id FROM murid WHERE murid_id = ? LIMIT 1',
        [muridId]
      );
      if (mRows.length === 0) {
        return NextResponse.json({ error: 'Santri tidak ditemukan' }, { status: 404 });
      }
      muridKelasIds = [Number(mRows[0].kelas_madin_id || 0), Number(mRows[0].kelas_madin_2_id || 0)].filter(Boolean);
    }

    if (mapel && mapel !== 'SEMUA' && mapel !== 'Semua Mapel') {
      if (role === 'guru' && guruId && guruScope) {
        let allowed = false;
        for (const kId of muridKelasIds) {
          if (await canGuruModifyMapel(guruId, kId, mapel, guruScope)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) {
          return NextResponse.json({ error: 'Anda tidak memiliki wewenang menghapus nilai mata pelajaran ini.' }, { status: 403 });
        }
      }

      await pool.execute(
        'DELETE FROM nilai_santri WHERE murid_id = ? AND mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ?',
        [muridId, mapel, semester, tahunAjaran]
      );
      return NextResponse.json({ success: true, message: `Nilai mapel ${mapel} berhasil dihapus` });
    } else {
      if (role === 'guru' && guruId && guruScope) {
        const isWali = muridKelasIds.some(kId => guruScope.waliKelasIds.has(kId));
        if (!isWali) {
          return NextResponse.json(
            { error: 'Hanya Wali Kelas atau Admin yang dapat menghapus seluruh nilai santri sekaligus.' },
            { status: 403 }
          );
        }
      }
      // Hapus seluruh nilai santri tersebut untuk semester & tahun ajaran ini
      await pool.execute(
        'DELETE FROM nilai_santri WHERE murid_id = ? AND semester = ? AND tahun_ajaran = ?',
        [muridId, semester, tahunAjaran]
      );
      return NextResponse.json({ success: true, message: 'Seluruh nilai santri pada semester ini berhasil dihapus/direset' });
    }
  } catch (error: any) {
    console.error('Error in DELETE /api/penilaian/save:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
