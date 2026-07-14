import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// DIAGNOSTIC ENDPOINT - Hapus setelah selesai debug!
// Akses: GET /api/debug/diagnosa
export async function GET() {
  try {
    const result: any = {};

    // ====== DIAGNOSA 1: USERS PENGURUS ASRAMA ======
    const [pengurusUsers] = await pool.execute<RowDataPacket[]>(`
      SELECT u.id, u.username, u.nama, u.role, u.kamar_id, 
             k.nama_kamar, k.nama_asrama
      FROM users u
      LEFT JOIN kamar k ON u.kamar_id = k.kamar_id
      WHERE u.role IN ('pengurus_asrama', 'staff_asrama', 'ketua_asrama')
      LIMIT 20
    `);
    result.pengurus_users = pengurusUsers;

    // Semua role yang ada
    const [allRoles] = await pool.execute<RowDataPacket[]>(`
      SELECT role, COUNT(*) as jumlah FROM users GROUP BY role ORDER BY jumlah DESC
    `);
    result.all_roles = allRoles;

    // User dengan kata asrama di username/nama
    const [asramaUsers] = await pool.execute<RowDataPacket[]>(`
      SELECT id, username, nama, role, kamar_id 
      FROM users 
      WHERE username LIKE '%asrama%' OR nama LIKE '%asrama%' 
      LIMIT 15
    `);
    result.users_with_asrama = asramaUsers;

    // ====== DIAGNOSA 2: TABEL KAMAR & NAMA_ASRAMA ======
    const [kamarRows] = await pool.execute<RowDataPacket[]>(`
      SELECT k.kamar_id, k.nama_kamar, k.nama_asrama, 
             COUNT(m.murid_id) as jumlah_santri
      FROM kamar k
      LEFT JOIN murid m ON m.kamar_id = k.kamar_id
      GROUP BY k.kamar_id
      ORDER BY k.nama_asrama, k.nama_kamar
    `);
    result.kamar_list = kamarRows;
    result.distinct_asrama = [...new Set(kamarRows.map((k: any) => k.nama_asrama).filter(Boolean))];

    // ====== DIAGNOSA 3: JADWAL & KELAS QURAN ======
    const [jadwalQuran] = await pool.execute<RowDataPacket[]>(`
      SELECT jq.id, jq.hari, jq.jam_mulai, jq.jam_selesai, jq.mata_pelajaran,
             jq.kelas_quran_id, kq.nama_kelas
      FROM jadwal_quran jq
      LEFT JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
      ORDER BY jq.hari, jq.jam_mulai
    `);
    result.jadwal_quran = jadwalQuran;
    result.jadwal_quran_total = jadwalQuran.length;

    const [kelasQuran] = await pool.execute<RowDataPacket[]>(`
      SELECT kq.id, kq.nama_kelas, COUNT(m.murid_id) as jumlah_santri
      FROM kelas_quran kq
      LEFT JOIN murid m ON m.kelas_quran_id = kq.id
      GROUP BY kq.id
      ORDER BY kq.nama_kelas
    `);
    result.kelas_quran = kelasQuran;

    // ====== DIAGNOSA 4: SIMULASI resolveAsrama per user pengurus ======
    result.simulate_resolve_asrama = [];
    for (const user of pengurusUsers.slice(0, 5)) {
      const sim: any = { user_id: user.id, username: user.username, nama: user.nama, role: user.role };
      
      // Step 1: kamar_id -> nama_asrama
      if (user.kamar_id) {
        const [step1] = await pool.execute<RowDataPacket[]>(
          `SELECT k.nama_asrama FROM users u JOIN kamar k ON u.kamar_id = k.kamar_id WHERE u.id = ? AND k.nama_asrama IS NOT NULL AND k.nama_asrama != '' LIMIT 1`,
          [user.id]
        );
        sim.step1_kamar_asrama = step1.length > 0 ? step1[0].nama_asrama : null;
      } else {
        sim.step1_kamar_asrama = null;
        sim.step1_note = 'kamar_id IS NULL';
      }
      
      // Step 2: pola nama user
      const namaMatch = user.nama ? user.nama.match(/asrama\s+([a-z])/i) : null;
      sim.step2_nama_match = namaMatch ? `Asrama ${namaMatch[1].toUpperCase()}` : null;
      
      // Step 3: pola username
      const usernameMatch1 = user.username.match(/asrama[_\-\s]?([a-f])(?:[_\-\s]|$)/i);
      const usernameMatch2 = user.username.match(/asrama.*?([a-f])(?:\b|_|$)/i);
      sim.step3_username_match = usernameMatch1 ? `Asrama ${usernameMatch1[1].toUpperCase()}` :
                                 usernameMatch2 ? `Asrama ${usernameMatch2[1].toUpperCase()}` : null;
      
      // Final resolved
      sim.resolved_asrama = sim.step1_kamar_asrama || sim.step2_nama_match || sim.step3_username_match || 'NULL - TIDAK TERDETEKSI!';
      
      // Cek jadwal quran yang akan muncul
      if (sim.step1_kamar_asrama || sim.step2_nama_match || sim.step3_username_match) {
        const resolvedName = sim.step1_kamar_asrama || sim.step2_nama_match || sim.step3_username_match;
        const [jadwalCheck] = await pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) as total FROM jadwal_quran WHERE kelas_quran_id IN (
            SELECT DISTINCT m.kelas_quran_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
          )`,
          [resolvedName]
        );
        sim.jadwal_quran_count = jadwalCheck[0].total;
        
        // Kelas quran yang ada santri dari asrama ini
        const [kelasCheck] = await pool.execute<RowDataPacket[]>(
          `SELECT DISTINCT kq.id, kq.nama_kelas, COUNT(m.murid_id) as santri_asrama
           FROM murid m
           JOIN kamar km ON m.kamar_id = km.kamar_id
           JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
           GROUP BY kq.id`,
          [resolvedName]
        );
        sim.kelas_quran_for_asrama = kelasCheck;
      }
      
      result.simulate_resolve_asrama.push(sim);
    }

    // ====== DIAGNOSA 5: FOTO SANTRI ======
    const [fotoStats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN foto IS NULL OR foto = '' OR foto = '-' THEN 1 ELSE 0 END) as tanpa_foto,
        SUM(CASE WHEN foto LIKE 'Berkas_%' THEN 1 ELSE 0 END) as foto_berkas,
        SUM(CASE WHEN foto LIKE 'http%' THEN 1 ELSE 0 END) as foto_url,
        SUM(CASE WHEN foto IS NOT NULL AND foto != '' AND foto != '-' 
             AND foto NOT LIKE 'Berkas_%' AND foto NOT LIKE 'http%' THEN 1 ELSE 0 END) as foto_lokal
      FROM murid
    `);
    result.foto_stats = fotoStats[0];

    // Sample foto values
    const [fotoSamples] = await pool.execute<RowDataPacket[]>(`
      SELECT murid_id, nama, foto 
      FROM murid 
      WHERE foto IS NOT NULL AND foto != '' AND foto != '-'
      LIMIT 10
    `);
    result.foto_samples = fotoSamples;

    // ====== DIAGNOSA 6: CEK SANTRI TANPA KELAS QURAN ======
    const [quranStats] = await pool.execute<RowDataPacket[]>(`
      SELECT
        COUNT(*) as total_santri,
        SUM(CASE WHEN kelas_quran_id IS NULL OR kelas_quran_id = 0 THEN 1 ELSE 0 END) as tanpa_kelas_quran,
        SUM(CASE WHEN kelas_quran_id IS NOT NULL AND kelas_quran_id != 0 THEN 1 ELSE 0 END) as punya_kelas_quran
      FROM murid
    `);
    result.santri_quran_stats = quranStats[0];

    // ====== DIAGNOSA 7: CEK KOLOM FOTO DI MURID ======
    const [muridColumns] = await pool.execute<RowDataPacket[]>(`SHOW COLUMNS FROM murid`);
    result.murid_columns = muridColumns.map((c: any) => ({ field: c.Field, type: c.Type }));

    return NextResponse.json({ success: true, data: result }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
