import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const { role } = payload as any;
  if (role !== 'admin' && role !== 'staff') return null;

  return payload;
}

export async function POST(request: Request) {
  try {
    const auth = await checkAuth();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { alumni_id } = body;

    if (!alumni_id) {
      return NextResponse.json({ error: 'ID Alumni tidak valid' }, { status: 400 });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Ambil data alumni
      const [alumniRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM alumni WHERE alumni_id = ?',
        [alumni_id]
      );

      if (alumniRows.length === 0) {
        connection.release();
        return NextResponse.json({ error: 'Data alumni tidak ditemukan' }, { status: 404 });
      }

      const alumni = alumniRows[0];

      // 2. Deteksi dinamis kolom-kolom yang ada di tabel murid
      const [colRows]: any = await connection.execute('SHOW COLUMNS FROM murid');
      const existingMuridCols = new Set<string>(colRows.map((c: any) => c.Field.toLowerCase()));

      // 3. Susun data santri yang akan dikembalikan ke tabel murid
      const noHpWaliVal = alumni.no_hp_wali || (alumni as any).no_wali || null;
      const candidateData: Record<string, any> = {};

      if (existingMuridCols.has('nama')) candidateData['nama'] = alumni.nama;
      if (existingMuridCols.has('nis')) candidateData['nis'] = alumni.nis || null;
      if (existingMuridCols.has('nik')) candidateData['nik'] = alumni.nik || null;
      if (existingMuridCols.has('no_hp')) candidateData['no_hp'] = alumni.no_hp || null;
      if (existingMuridCols.has('alamat')) candidateData['alamat'] = alumni.alamat || null;
      if (existingMuridCols.has('foto')) candidateData['foto'] = alumni.foto || null;
      if (existingMuridCols.has('jenis_kelamin')) candidateData['jenis_kelamin'] = alumni.jenis_kelamin || null;
      if (existingMuridCols.has('nama_panggilan')) candidateData['nama_panggilan'] = alumni.nama_panggilan || null;
      if (existingMuridCols.has('barcode_id')) candidateData['barcode_id'] = alumni.barcode_id || null;
      if (existingMuridCols.has('kamar_id')) candidateData['kamar_id'] = alumni.last_kamar_id || null;
      if (existingMuridCols.has('kelas_madin_id')) candidateData['kelas_madin_id'] = alumni.last_kelas_madin_id || null;
      if (existingMuridCols.has('kelas_quran_id')) candidateData['kelas_quran_id'] = alumni.last_kelas_quran_id || null;
      if (existingMuridCols.has('nama_wali')) candidateData['nama_wali'] = alumni.nama_wali || null;

      // Di tabel murid kolom telepon wali adalah 'no_wali' (dukung juga 'no_hp_wali' jika ada)
      if (existingMuridCols.has('no_wali')) candidateData['no_wali'] = noHpWaliVal;
      if (existingMuridCols.has('no_hp_wali')) candidateData['no_hp_wali'] = noHpWaliVal;

      if (existingMuridCols.has('created_at')) candidateData['created_at'] = alumni.created_at || new Date();
      if (existingMuridCols.has('updated_at')) candidateData['updated_at'] = new Date();

      const insertCols = Object.keys(candidateData);
      const insertPlaceholders = insertCols.map(() => '?').join(', ');
      const insertValues = insertCols.map(col => candidateData[col]);

      // Matikan foreign key checks sementara untuk menghindari constraint error
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

      // Bersihkan sisa data lama di murid dengan NIS yang sama jika ada
      if (alumni.nis) {
        await connection.execute('DELETE FROM murid WHERE nis = ?', [alumni.nis]);
      }

      const insertSql = `INSERT INTO murid (${insertCols.join(', ')}) VALUES (${insertPlaceholders})`;
      const [insertResult] = await connection.execute<ResultSetHeader>(insertSql, insertValues);
      const newMuridId = insertResult.insertId;

      // 4. Update akun user terkait jika ada
      if (alumni.nis) {
        await connection.execute(
          `UPDATE users 
           SET role = CASE WHEN role IN ('alumni', 'wali_alumni') THEN 'wali_murid' ELSE role END,
               murid_id = ? 
           WHERE username = ? AND username != ''`,
          [newMuridId, alumni.nis]
        );
      }

      // 5. Hapus data dari tabel alumni
      await connection.execute('DELETE FROM alumni WHERE alumni_id = ?', [alumni_id]);

      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        message: `Santri ${alumni.nama} berhasil dipulihkan sebagai murid aktif.`
      });
    } catch (dbError: any) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error POST /api/alumni/restore:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
