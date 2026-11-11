import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { ensureUjianDB } from '@/lib/ensureUjianDB';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await ensureUjianDB();

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    const userRoleLower = (payload.role || '').toLowerCase();
    const canManageSoal = ['admin', 'staff', 'guru', 'pengasuh', 'pengurus_asrama'].includes(userRoleLower);
    if (!payload || !canManageSoal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    let ujianId: number | null = null;
    let rowsToProcess: any[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const ujianIdRaw = formData.get('ujian_id');
      ujianId = ujianIdRaw ? Number(ujianIdRaw) : null;

      if (!file) {
        return NextResponse.json({ error: 'File Excel (.xlsx) tidak ditemukan dalam form data.' }, { status: 400 });
      }
      if (!ujianId) {
        return NextResponse.json({ error: 'Parameter ujian_id wajib diisi.' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const workbook = xlsx.read(buffer, { type: 'buffer' });

      // Ambil sheet pertama atau sheet bernama 'Template Soal'
      const sheetName = workbook.SheetNames.includes('Template Soal')
        ? 'Template Soal'
        : workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return NextResponse.json({ error: 'Sheet soal tidak ditemukan dalam file.' }, { status: 400 });
      }

      // Konversi sheet ke array of arrays (header 1)
      const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      if (rawRows.length < 2) {
        return NextResponse.json({ error: 'File Excel kosong atau tidak memiliki data soal.' }, { status: 400 });
      }

      // Cari baris header
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
        const rowStr = (rawRows[i] || []).join(' ').toLowerCase();
        if (rowStr.includes('pertanyaan') || rowStr.includes('tipe') || rowStr.includes('kunci')) {
          headerRowIdx = i;
          break;
        }
      }

      // Parse baris setelah header
      for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const no = row[0];
        const tipeRaw = String(row[1] || '').trim().toUpperCase();
        const pertanyaan = String(row[2] || '').trim();
        const opsiA = row[3] !== undefined ? String(row[3]).trim() : '';
        const opsiB = row[4] !== undefined ? String(row[4]).trim() : '';
        const opsiC = row[5] !== undefined ? String(row[5]).trim() : '';
        const opsiD = row[6] !== undefined ? String(row[6]).trim() : '';
        const opsiE = row[7] !== undefined ? String(row[7]).trim() : '';
        const kunci = row[8] !== undefined ? String(row[8]).trim() : '';
        const kataKunci = row[9] !== undefined ? String(row[9]).trim() : '';
        const bobot = row[10] !== undefined ? Number(row[10]) : 10;
        const pembahasan = row[11] !== undefined ? String(row[11]).trim() : '';

        if (!pertanyaan) continue; // Abaikan baris kosong

        const isEssay = tipeRaw.includes('ESSAY') || (!opsiA && !opsiB && kunci.length > 2);

        rowsToProcess.push({
          nomor_urut: Number(no) || rowsToProcess.length + 1,
          tipe_soal: isEssay ? 'essay' : 'pilihan_ganda',
          pertanyaan,
          opsi_a: isEssay ? null : (opsiA || null),
          opsi_b: isEssay ? null : (opsiB || null),
          opsi_c: isEssay ? null : (opsiC || null),
          opsi_d: isEssay ? null : (opsiD || null),
          opsi_e: isEssay ? null : (opsiE || null),
          kunci_jawaban: kunci ? kunci.trim() : (isEssay ? null : 'A'),
          rubrik_kata_kunci: kataKunci || null,
          bobot_nilai: isNaN(bobot) || bobot <= 0 ? 10 : bobot,
          pembahasan: pembahasan || null,
        });
      }
    } else {
      // JSON body
      const body = await request.json();
      ujianId = Number(body.ujian_id);
      rowsToProcess = body.soal_list || [];
    }

    if (!ujianId) {
      return NextResponse.json({ error: 'ujian_id diperlukan.' }, { status: 400 });
    }

    if (rowsToProcess.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data butir soal yang valid untuk diimpor.' }, { status: 400 });
    }

    // Ambil nomor urut terakhir pada ujian ini
    const [lastNumRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COALESCE(MAX(nomor_urut), 0) as max_no FROM ujian_soal WHERE ujian_id = ?',
      [ujianId]
    );
    let nextNum = Number(lastNumRows[0]?.max_no || 0) + 1;

    let insertedCount = 0;
    let essayCount = 0;
    let pgCount = 0;

    for (const item of rowsToProcess) {
      const tipe = item.tipe_soal === 'essay' ? 'essay' : 'pilihan_ganda';
      const nomor = item.nomor_urut || nextNum;

      await pool.execute(
        `INSERT INTO ujian_soal 
          (ujian_id, tipe_soal, nomor_urut, pertanyaan, gambar, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci_jawaban, rubrik_kata_kunci, bobot_nilai, pembahasan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ujianId,
          tipe,
          nomor,
          item.pertanyaan,
          item.gambar || null,
          item.opsi_a || null,
          item.opsi_b || null,
          item.opsi_c || null,
          item.opsi_d || null,
          item.opsi_e || null,
          item.kunci_jawaban || null,
          item.rubrik_kata_kunci || null,
          Number(item.bobot_nilai) || 10,
          item.pembahasan || null,
        ]
      );

      insertedCount++;
      if (tipe === 'essay') essayCount++;
      else pgCount++;
      nextNum++;
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${insertedCount} butir soal (${pgCount} Pilihan Ganda, ${essayCount} Essay).`,
      total_imported: insertedCount,
      pg_count: pgCount,
      essay_count: essayCount,
    });
  } catch (error: any) {
    console.error('Error importing soal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
