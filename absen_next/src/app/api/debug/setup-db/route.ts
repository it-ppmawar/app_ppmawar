import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

// Endpoint setup: Buat tabel jadwal_alumni & jurnal jika belum ada
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const queries = [
      `CREATE TABLE IF NOT EXISTS jadwal_alumni (
        id INT AUTO_INCREMENT PRIMARY KEY,
        jam_mulai TIME NOT NULL,
        jam_selesai TIME NOT NULL,
        kegiatan VARCHAR(255) NOT NULL,
        tempat VARCHAR(255) NOT NULL,
        keterangan TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS jurnal_madin (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tanggal DATE NOT NULL,
        guru_id INT NOT NULL,
        kelas_id INT NOT NULL,
        materi TEXT NOT NULL,
        catatan TEXT NOT NULL,
        kendala TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS jurnal_quran (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tanggal DATE NOT NULL,
        guru_id INT NOT NULL,
        kelas_quran_id INT NOT NULL,
        materi TEXT NOT NULL,
        catatan TEXT NOT NULL,
        kendala TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS jurnal_kamar (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tanggal DATE NOT NULL,
        pembina_id INT NOT NULL,
        kamar_id INT NOT NULL,
        kegiatan TEXT NOT NULL,
        catatan TEXT NOT NULL,
        kendala TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];

    const results: string[] = [];
    for (const query of queries) {
      try {
        await pool.execute(query);
        const tableName = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
        results.push(`✓ Tabel ${tableName} siap`);
      } catch (err: any) {
        results.push(`✗ Error: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, message: 'Setup database selesai', results });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
