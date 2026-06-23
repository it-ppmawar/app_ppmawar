import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Endpoint setup asrama - untuk mendiagnosa dan mengisi nama_asrama
// GET: cek data kamar dan user asrama
// POST: isi nama_asrama berdasarkan nama_kamar pattern
export async function GET() {
  try {
    // Cek semua kamar beserta nama_asrama
    const [kamarRows] = await pool.execute<RowDataPacket[]>(
      `SELECT kamar_id, nama_kamar, nama_asrama FROM kamar ORDER BY nama_kamar ASC`
    );

    // Cek semua user pengurus_asrama
    const [userRows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.username, u.role, u.kamar_id, 
              k.nama_kamar, k.nama_asrama
       FROM users u
       LEFT JOIN kamar k ON u.kamar_id = k.kamar_id
       WHERE u.role = 'pengurus_asrama'
       ORDER BY u.username`
    );

    // Cek distinct nilai nama_asrama yang sudah ada
    const [asramaDistinct] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT nama_asrama, COUNT(*) as jumlah_kamar
       FROM kamar 
       GROUP BY nama_asrama 
       ORDER BY nama_asrama`
    );

    // Cek jumlah santri per asrama
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
      kamar_tanpa_asrama: kamarRows.filter((k: any) => !k.nama_asrama).length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Auto-assign nama_asrama dari pattern nama_kamar
// Body: { mode: 'auto' } -> otomatis dari 'Asrama X' di nama_kamar
// Body: { mode: 'manual', mappings: [{kamar_id, nama_asrama}] } -> manual
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, mappings } = body;

    let updated = 0;
    const results: any[] = [];

    if (mode === 'auto') {
      // Ambil semua kamar
      const [kamarRows] = await pool.execute<RowDataPacket[]>(
        `SELECT kamar_id, nama_kamar FROM kamar`
      );

      for (const kamar of kamarRows) {
        // Cari pola nama asrama dari nama_kamar
        // Contoh: "Asrama A - Kamar 1" -> "Asrama A"
        // Contoh: "A1", "A2" -> "Asrama A"
        // Contoh: "ASRAMA A" -> "Asrama A"
        let namaAsrama: string | null = null;
        const nama = kamar.nama_kamar?.toString() || '';
        
        // Pattern 1: Mengandung kata "Asrama X" (case insensitive)
        const matchAsrama = nama.match(/asrama\s+([A-Fa-f])/i);
        if (matchAsrama) {
          namaAsrama = `Asrama ${matchAsrama[1].toUpperCase()}`;
        }
        
        // Pattern 2: Nama kamar dimulai dengan huruf A-F diikuti angka (misal A1, B2)
        if (!namaAsrama) {
          const matchKode = nama.match(/^([A-Fa-f])\d+/);
          if (matchKode) {
            namaAsrama = `Asrama ${matchKode[1].toUpperCase()}`;
          }
        }

        if (namaAsrama) {
          await pool.execute(
            `UPDATE kamar SET nama_asrama = ? WHERE kamar_id = ?`,
            [namaAsrama, kamar.kamar_id]
          );
          updated++;
          results.push({ kamar_id: kamar.kamar_id, nama_kamar: nama, nama_asrama: namaAsrama });
        }
      }
    } else if (mode === 'manual' && Array.isArray(mappings)) {
      for (const { kamar_id, nama_asrama } of mappings) {
        await pool.execute(
          `UPDATE kamar SET nama_asrama = ? WHERE kamar_id = ?`,
          [nama_asrama, kamar_id]
        );
        updated++;
        results.push({ kamar_id, nama_asrama });
      }
    }

    // Juga pastikan users pengurus_asrama punya kamar_id yang valid
    // dengan mencari kamar pertama dari asrama yang sesuai dengan username
    const [pengurus] = await pool.execute<RowDataPacket[]>(
      `SELECT id, username FROM users WHERE role = 'pengurus_asrama' AND kamar_id IS NULL`
    );

    let usersFixed = 0;
    for (const user of pengurus) {
      // Coba tebak asrama dari username: ketua_asrama_a -> Asrama A
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
      fixed_users: usersFixed,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
