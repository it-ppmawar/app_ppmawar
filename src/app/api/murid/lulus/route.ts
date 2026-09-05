import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { verifyToken } from '@/lib/auth/jwt';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Hanya admin atau staff yang dapat melakukan aksi ini' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ids } = body; 
    const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'ID Murid tidak valid' }, { status: 400 });
    }

    // 1. Pastikan tabel alumni sudah ada
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS alumni (
        alumni_id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(255) NOT NULL,
        nis VARCHAR(50) DEFAULT NULL,
        nik VARCHAR(50) DEFAULT NULL,
        no_hp VARCHAR(50) DEFAULT NULL,
        alamat TEXT DEFAULT NULL,
        tahun_masuk INT DEFAULT NULL,
        tahun_keluar INT DEFAULT NULL,
        status_keluar VARCHAR(50) DEFAULT 'Lulus',
        foto VARCHAR(255) DEFAULT NULL,
        jenis_kelamin VARCHAR(20) DEFAULT NULL,
        kategori_mukim VARCHAR(20) DEFAULT 'PPM',
        keterangan TEXT DEFAULT NULL,
        last_kamar_id INT DEFAULT NULL,
        last_kelas_madin_id INT DEFAULT NULL,
        last_kelas_quran_id INT DEFAULT NULL,
        nama_panggilan VARCHAR(100) DEFAULT NULL,
        barcode_id VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_alumni_nis (nis),
        INDEX idx_alumni_nama (nama)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Ambil daftar kolom yang ada di tabel alumni
    const [colRows]: any = await pool.execute('SHOW COLUMNS FROM alumni');
    const existingCols = new Set<string>(colRows.map((c: any) => c.Field.toLowerCase()));

    // 3. Kolom tambahan yang perlu dipastikan ada
    const neededCols = [
      { name: 'last_kamar_id', type: 'INT NULL' },
      { name: 'last_kelas_madin_id', type: 'INT NULL' },
      { name: 'last_kelas_quran_id', type: 'INT NULL' },
      { name: 'nama_panggilan', type: 'VARCHAR(100) NULL' },
      { name: 'barcode_id', type: 'VARCHAR(100) NULL' },
      { name: 'kategori_mukim', type: "VARCHAR(20) NOT NULL DEFAULT 'PPM'" },
      { name: 'jenis_kelamin', type: 'VARCHAR(20) NULL' },
      { name: 'nik', type: 'VARCHAR(50) NULL' },
      { name: 'no_hp', type: 'VARCHAR(50) NULL' },
      { name: 'alamat', type: 'TEXT NULL' },
      { name: 'status_keluar', type: "VARCHAR(50) DEFAULT 'Lulus'" },
      { name: 'keterangan', type: 'TEXT NULL' },
      { name: 'foto', type: 'VARCHAR(255) NULL' }
    ];

    for (const col of neededCols) {
      if (!existingCols.has(col.name.toLowerCase())) {
        try {
          await pool.execute(`ALTER TABLE alumni ADD COLUMN ${col.name} ${col.type}`);
          existingCols.add(col.name.toLowerCase());
        } catch {
          // Abaikan jika sudah ada
        }
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let successCount = 0;

      for (const currentId of targetIds) {
        const [muridRows] = await connection.execute<RowDataPacket[]>(
          `SELECT m.*, km.nama_kamar, kmd.nama_kelas as nama_kelas_madin, kq.nama_kelas as nama_kelas_quran 
           FROM murid m
           LEFT JOIN kamar km ON m.kamar_id = km.kamar_id
           LEFT JOIN kelas_madin kmd ON m.kelas_madin_id = kmd.kelas_id
           LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE m.murid_id = ?`, 
          [currentId]
        );
        if (muridRows.length === 0) continue;
        const murid = muridRows[0];

        const tahunMasuk = murid.created_at ? new Date(murid.created_at).getFullYear() : new Date().getFullYear() - 3;
        const tahunKeluar = new Date().getFullYear();

        // Susun riwayat pendidikan terakhir
        const parts = [];
        if (murid.nama_kamar) parts.push(`Kamar: ${murid.nama_kamar}`);
        if (murid.nama_kelas_madin) parts.push(`Madin: ${murid.nama_kelas_madin}`);
        if (murid.nama_kelas_quran) parts.push(`Qur'an: ${murid.nama_kelas_quran}`);
        const riwayat = parts.length > 0 ? parts.join(' | ') : 'Tidak ada riwayat kelas';

        // Siapkan data mapping untuk alumni
        const alumniData: Record<string, any> = {
          nama: murid.nama,
          nis: murid.nis || null,
          nik: murid.nik || null,
          no_hp: murid.no_hp || null,
          alamat: murid.alamat || null,
          tahun_masuk: tahunMasuk,
          tahun_keluar: tahunKeluar,
          status_keluar: 'Lulus',
          foto: murid.foto || null,
          jenis_kelamin: murid.jenis_kelamin || null,
          kategori_mukim: 'PPM',
          keterangan: riwayat,
          last_kamar_id: murid.kamar_id || null,
          last_kelas_madin_id: murid.kelas_madin_id || null,
          last_kelas_quran_id: murid.kelas_quran_id || null,
          nama_panggilan: murid.nama_panggilan || null,
          barcode_id: murid.barcode_id || null
        };

        // Filter hanya field yang benar-benar ada di tabel alumni
        const validKeys = Object.keys(alumniData).filter(k => existingCols.has(k.toLowerCase()));
        const placeholders = validKeys.map(() => '?').join(', ');
        const values = validKeys.map(k => alumniData[k]);

        // Hapus duplikat alumni lama dengan NIS yang sama (jika ada) agar tidak gagal UNIQUE
        if (murid.nis) {
          await connection.execute('DELETE FROM alumni WHERE nis = ?', [murid.nis]);
        }

        const insertSql = `INSERT INTO alumni (${validKeys.join(', ')}) VALUES (${placeholders})`;
        await connection.execute(insertSql, values);

        // Update user akun terkait
        await connection.execute(
          'UPDATE users SET role = ?, murid_id = NULL WHERE murid_id = ? OR (username = ? AND username != "")',
          ['alumni', murid.murid_id, murid.nis || '']
        );

        // Matikan foreign key checks sementara agar delete murid tidak terblokir foreign key lama
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('DELETE FROM murid WHERE murid_id = ?', [murid.murid_id]);
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        successCount++;
      }

      await connection.commit();
      connection.release();

      if (successCount === 0) {
        return NextResponse.json({ error: 'Tidak ada data santri yang diproses.' }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        message: `${successCount} Santri berhasil diluluskan dan dipindah ke daftar Alumni. Akun User terkait telah dikonversi menjadi role Alumni.` 
      });
    } catch (error: any) {
      await connection.rollback();
      connection.release();
      console.error('Database transaction error in /api/murid/lulus:', error);
      return NextResponse.json({ error: error?.message || 'Gagal menyimpan data kelulusan' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error luluskan murid:', error);
    return NextResponse.json({ error: error?.message || 'Terjadi kesalahan server saat memproses data' }, { status: 500 });
  }
}
