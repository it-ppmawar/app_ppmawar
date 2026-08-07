import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Helper untuk mengonsolidasikan & menghapus kamar ganda (misal A-1 dan A1)
async function consolidateDuplicateKamar() {
  let mergedCount = 0;
  try {
    // 1. Normalisasi nama_asrama awal jika masih berupa huruf tunggal (misal 'A' -> 'Asrama A')
    await pool.execute(
      `UPDATE kamar SET nama_asrama = CONCAT('Asrama ', UPPER(nama_asrama)) 
       WHERE nama_asrama REGEXP '^[A-Fa-f]$'`
    );

    // 2. Isi nama_asrama untuk kamar yang masih NULL berdasarkan pattern nama_kamar (misal A-1, A1 -> Asrama A)
    const [unassignedKamar] = await pool.execute<RowDataPacket[]>(
      `SELECT kamar_id, nama_kamar FROM kamar WHERE nama_asrama IS NULL OR nama_asrama = ''`
    );
    for (const k of unassignedKamar) {
      const nama = (k.nama_kamar || '').toString();
      let namaAsrama: string | null = null;

      const matchAsrama = nama.match(/asrama\s+([A-Fa-f])/i);
      if (matchAsrama) namaAsrama = `Asrama ${matchAsrama[1].toUpperCase()}`;

      if (!namaAsrama) {
        const matchKode = nama.match(/^([A-Fa-f])[\d-]/);
        if (matchKode) namaAsrama = `Asrama ${matchKode[1].toUpperCase()}`;
      }

      if (namaAsrama) {
        await pool.execute(`UPDATE kamar SET nama_asrama = ? WHERE kamar_id = ?`, [namaAsrama, k.kamar_id]);
      }
    }

    // 3. Ambil seluruh kamar terkini
    const [allKamar] = await pool.execute<RowDataPacket[]>(
      `SELECT kamar_id, nama_kamar, nama_asrama FROM kamar ORDER BY kamar_id ASC`
    );

    // Helper untuk mengekstrak kode kamar standar (misal 'A-1' -> 'A1', 'A1' -> 'A1', 'A 1' -> 'A1')
    const getNormalizedCode = (k: any) => {
      const nama = (k.nama_kamar || '').toString().trim();
      const match = nama.match(/([A-Fa-f])[\s-]*(\d+)/);
      if (match) {
        return `${match[1].toUpperCase()}${match[2]}`;
      }
      return nama.toUpperCase().replace(/[^A-Z0-9]/g, '');
    };

    // Kelompokkan berdasarkan (nama_asrama, normalizedCode)
    const groups: Record<string, any[]> = {};
    for (const kamar of allKamar) {
      const asrama = (kamar.nama_asrama || '').toString().trim().toUpperCase();
      const code = getNormalizedCode(kamar);
      if (!code) continue;
      const key = `${asrama}:::${code}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(kamar);
    }

    for (const key in groups) {
      const list = groups[key];
      if (list.length > 1) {
        // Ada data kamar ganda!
        // Pilih kamar kanonikal: utamakan yang tanpa tanda hubung '-' (misal A1 dibanding A-1), atau ID lebih kecil
        list.sort((a, b) => {
          const aHasDash = a.nama_kamar.includes('-');
          const bHasDash = b.nama_kamar.includes('-');
          if (aHasDash !== bHasDash) return aHasDash ? 1 : -1;
          return a.kamar_id - b.kamar_id;
        });

        const canonical = list[0];
        const duplicates = list.slice(1);

        // Update nama_kamar kanonikal agar rapi (misal set ke 'A1')
        const cleanCode = getNormalizedCode(canonical);
        if (cleanCode && /^[A-F]\d+$/.test(cleanCode)) {
          await pool.execute(
            `UPDATE kamar SET nama_kamar = ? WHERE kamar_id = ?`,
            [cleanCode, canonical.kamar_id]
          );
        }

        for (const dup of duplicates) {
          // Pindahkan santri (murid) dari dup.kamar_id ke canonical.kamar_id
          await pool.execute(
            `UPDATE murid SET kamar_id = ? WHERE kamar_id = ?`,
            [canonical.kamar_id, dup.kamar_id]
          );

          // Pindahkan user pengurus dari dup.kamar_id ke canonical.kamar_id
          await pool.execute(
            `UPDATE users SET kamar_id = ? WHERE kamar_id = ?`,
            [canonical.kamar_id, dup.kamar_id]
          );

          // Pindahkan jadwal jika ada
          try {
            await pool.execute(
              `UPDATE jadwal SET kamar_id = ? WHERE kamar_id = ?`,
              [canonical.kamar_id, dup.kamar_id]
            );
          } catch (e) {}

          try {
            await pool.execute(
              `UPDATE jadwal_kegiatan SET kamar_id = ? WHERE kamar_id = ?`,
              [canonical.kamar_id, dup.kamar_id]
            );
          } catch (e) {}

          // Hapus kamar ganda dari tabel kamar
          await pool.execute(
            `DELETE FROM kamar WHERE kamar_id = ?`,
            [dup.kamar_id]
          );

          mergedCount++;
        }
      }
    }
  } catch (err) {
    console.error('[SETUP ASRAMA] Consolidate kamar error:', err);
  }
  return mergedCount;
}

// GET: Cek & konsolidasi otomatis data kamar dan user asrama
export async function GET() {
  try {
    // Jalankan konsolidasi kamar ganda secara otomatis
    const mergedCount = await consolidateDuplicateKamar();

    // 1. Cek semua kamar beserta nama_asrama setelah konsolidasi
    const [kamarRows] = await pool.execute<RowDataPacket[]>(
      `SELECT kamar_id, nama_kamar, nama_asrama FROM kamar ORDER BY nama_kamar ASC`
    );

    // 2. Cek semua user pengurus_asrama
    const [userRows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.role, u.kamar_id, 
              k.nama_kamar, k.nama_asrama
       FROM users u
       LEFT JOIN kamar k ON u.kamar_id = k.kamar_id
       WHERE u.role = 'pengurus_asrama'
       ORDER BY u.username`
    );

    // 3. Cek distinct nilai nama_asrama yang ada
    const [asramaDistinct] = await pool.execute<RowDataPacket[]>(
      `SELECT nama_asrama, COUNT(*) as jumlah_kamar
       FROM kamar 
       WHERE nama_asrama IS NOT NULL
       GROUP BY nama_asrama
       ORDER BY nama_asrama`
    );

    // 4. Cek jumlah santri per asrama
    const [santriPerAsrama] = await pool.execute<RowDataPacket[]>(
      `SELECT k.nama_asrama, COUNT(m.murid_id) as jumlah_santri
       FROM kamar k
       LEFT JOIN murid m ON m.kamar_id = k.kamar_id
       WHERE k.nama_asrama IS NOT NULL
       GROUP BY k.nama_asrama
       ORDER BY k.nama_asrama`
    );

    return NextResponse.json({
      kamar: kamarRows,
      users_asrama: userRows,
      asrama_terdaftar: asramaDistinct,
      santri_per_asrama: santriPerAsrama,
      total_kamar: kamarRows.length,
      merged_duplicate_kamar: mergedCount,
      kamar_tanpa_asrama: kamarRows.filter((k: any) => !k.nama_asrama).length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Auto-fix & Hapus Kamar Ganda
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, mappings } = body;

    const mergedCount = await consolidateDuplicateKamar();
    let updated = mergedCount;
    const results: any[] = [];

    if (mode === 'manual' && Array.isArray(mappings)) {
      for (const { kamar_id, nama_asrama } of mappings) {
        await pool.execute(
          `UPDATE kamar SET nama_asrama = ? WHERE kamar_id = ?`,
          [nama_asrama, kamar_id]
        );
        updated++;
        results.push({ kamar_id, nama_asrama });
      }
    }

    // Pastikan users pengurus_asrama punya kamar_id yang valid
    const [pengurus] = await pool.execute<RowDataPacket[]>(
      `SELECT id, username FROM users WHERE role = 'pengurus_asrama' AND kamar_id IS NULL`
    );

    let usersFixed = 0;
    for (const user of pengurus) {
      const matchUser = user.username.match(/asrama_([a-f])/i);
      if (matchUser) {
        const namaAsrama = `Asrama ${matchUser[1].toUpperCase()}`;
        const [kamarRef] = await pool.execute<RowDataPacket[]>(
          `SELECT kamar_id FROM kamar WHERE nama_asrama = ? LIMIT 1`,
          [namaAsrama]
        );
        if (kamarRef.length > 0) {
          await pool.execute(
            `UPDATE users SET kamar_id = ? WHERE id = ?`,
            [kamarRef[0].kamar_id, user.id]
          );
          usersFixed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated_kamar: updated,
      merged_duplicate_kamar: mergedCount,
      fixed_users: usersFixed,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
