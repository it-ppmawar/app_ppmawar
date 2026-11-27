import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { resolvePenilaianAuth } from '@/lib/auth/penilaianAuth';
import { ensurePenilaianDB } from '@/lib/ensurePenilaianDB';
import {
  calcNilaiAkhir,
  calcPredikat,
  isEmptyPredikat,
  isEmptyScoreVal,
  isResidualZeroScoreRow,
  parseClampedScore,
} from '@/lib/penilaian/calcNilai';

export const dynamic = 'force-dynamic';

const isEmptyVal = isEmptyScoreVal;

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

    let savedCount = 0;
    let deletedCount = 0;

    // Preload santri yang sudah memiliki baris nilai untuk mapel/periode ini agar pengosongan form benar-benar menghapus baris DB
    const submittedMuridIds = Array.from(
      new Set(
        scores
          .map((item: any) => Number(item?.murid_id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    );
    const existingMuridIds = new Set<number>();
    if (submittedMuridIds.length > 0) {
      const placeholders = submittedMuridIds.map(() => '?').join(',');
      const [existingRows] = await pool.execute<RowDataPacket[]>(
        `SELECT murid_id FROM nilai_santri
         WHERE mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ? AND murid_id IN (${placeholders})`,
        [mata_pelajaran, semester, tahun_ajaran, ...submittedMuridIds]
      );
      existingRows.forEach(r => existingMuridIds.add(Number(r.murid_id)));
    }

    const verifyAllKelasGuruPermission = async (muridId: number, kelasMadinId: any): Promise<boolean> => {
      if (role !== 'guru' || !guruId || !guruScope || (kelas_id !== 'SEMUA' && kelas_id !== 'all')) {
        return true;
      }
      let resolvedKId = kelasMadinId ? Number(kelasMadinId) : null;
      if (!resolvedKId) {
        const [mRows] = await pool.execute<RowDataPacket[]>(
          'SELECT kelas_madin_id, kelas_madin_2_id FROM murid WHERE murid_id = ? LIMIT 1',
          [muridId]
        );
        if (mRows.length > 0) {
          const k1 = Number(mRows[0].kelas_madin_id || 0);
          const k2 = Number(mRows[0].kelas_madin_2_id || 0);
          if (k1 && (guruScope.waliKelasIds.has(k1) || guruScope.taughtKelasIds.has(k1))) resolvedKId = k1;
          else if (k2 && (guruScope.waliKelasIds.has(k2) || guruScope.taughtKelasIds.has(k2))) resolvedKId = k2;
        }
      }
      return canGuruModifyMapel(guruId, resolvedKId, mata_pelajaran, guruScope);
    };

    // Upsert setiap nilai dengan dukungan manual override & pembersihan nilai yang dikosongkan guru
    for (const item of scores) {
      if (!item.murid_id) continue;
      const mId = Number(item.murid_id);

      const isClearedOrEmpty =
        (
          isEmptyVal(item.nilai_harian) &&
          isEmptyVal(item.nilai_lisan) &&
          isEmptyVal(item.nilai_uts) &&
          isEmptyVal(item.nilai_uas) &&
          isEmptyVal(item.nilai_akhir) &&
          isEmptyVal(item.catatan)
        ) ||
        isResidualZeroScoreRow(item);

      if (isClearedOrEmpty) {
        if (existingMuridIds.has(mId)) {
          const allowed = await verifyAllKelasGuruPermission(mId, item.kelas_madin_id);
          if (!allowed) {
            return NextResponse.json({ error: 'Anda tidak memiliki wewenang menghapus nilai pada kelas/mapel santri ini.' }, { status: 403 });
          }
          await pool.execute(
            'DELETE FROM nilai_santri WHERE murid_id = ? AND mata_pelajaran = ? AND semester = ? AND tahun_ajaran = ?',
            [mId, mata_pelajaran, semester, tahun_ajaran]
          );
          deletedCount++;
        }
        continue;
      }

      const harian = !isEmptyVal(item.nilai_harian) ? parseClampedScore(item.nilai_harian) : null;
      const lisan = !isEmptyVal(item.nilai_lisan) ? parseClampedScore(item.nilai_lisan) : null;
      const uts = !isEmptyVal(item.nilai_uts) ? parseClampedScore(item.nilai_uts) : null;
      const uas = !isEmptyVal(item.nilai_uas) ? parseClampedScore(item.nilai_uas) : null;

      // Fleksibilitas: Jika pengguna/guru mengisi atau mengubah nilai_akhir secara manual, gunakan nilai manual tersebut.
      // Jika tidak diisi manual, gunakan kalkulasi dinamis (25% masing-masing jika Lisan diisi, atau 30/30/40 jika kosong).
      let nilaiAkhir: number | null = null;
      if (!isEmptyVal(item.nilai_akhir)) {
        nilaiAkhir = parseClampedScore(item.nilai_akhir);
      } else {
        nilaiAkhir = calcNilaiAkhir({
          harian: item.nilai_harian,
          lisan: item.nilai_lisan,
          uts: item.nilai_uts,
          uas: item.nilai_uas,
        });
      }

      // Predikat: gunakan predikat yang diubah manual guru jika valid (A–E), atau hitung otomatis
      const hasAnyComponent =
        harian !== null ||
        lisan !== null ||
        uts !== null ||
        uas !== null ||
        nilaiAkhir !== null;
      const predikat = !isEmptyPredikat(item.predikat)
        ? String(item.predikat).trim().toUpperCase()
        : (hasAnyComponent && nilaiAkhir !== null ? (nilaiAkhir === 0 ? 'E' : calcPredikat(nilaiAkhir)) : '-');

      const targetKelasId = (kelas_id === 'SEMUA' || kelas_id === 'all')
        ? (item.kelas_madin_id || null)
        : kelas_id;

      // RBAC tambahan saat kelas_id === 'SEMUA'
      const allowed = await verifyAllKelasGuruPermission(mId, targetKelasId);
      if (!allowed) {
        return NextResponse.json({ error: 'Anda tidak memiliki wewenang menginput nilai pada kelas/mapel santri ini.' }, { status: 403 });
      }

      await pool.execute(`
        INSERT INTO nilai_santri 
          (murid_id, kelas_madin_id, kurikulum_id, mata_pelajaran, kitab, semester, tahun_ajaran, nilai_harian, nilai_lisan, nilai_uts, nilai_uas, nilai_akhir, predikat, catatan, guru_id)
        VALUES (?, COALESCE(?, (SELECT kelas_madin_id FROM murid WHERE murid_id = ? LIMIT 1)), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          kelas_madin_id = VALUES(kelas_madin_id),
          kurikulum_id = VALUES(kurikulum_id),
          kitab = VALUES(kitab),
          nilai_harian = VALUES(nilai_harian),
          nilai_lisan = VALUES(nilai_lisan),
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
        lisan,
        uts,
        uas,
        nilaiAkhir,
        predikat,
        item.catatan || null,
        guruId || userId || null
      ]);
      savedCount++;
    }

    let message = 'Tidak ada perubahan nilai yang terisi untuk disimpan.';
    if (savedCount > 0 && deletedCount > 0) {
      message = `Berhasil menyimpan nilai untuk ${savedCount} santri dan membersihkan ${deletedCount} data nilai kosong.`;
    } else if (savedCount > 0) {
      message = `Berhasil menyimpan nilai untuk ${savedCount} santri.`;
    } else if (deletedCount > 0) {
      message = `Berhasil membersihkan/mengosongkan nilai untuk ${deletedCount} santri.`;
    }

    return NextResponse.json({
      success: true,
      savedCount,
      deletedCount,
      message,
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
