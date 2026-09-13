import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

function getDumpPath(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), 'DOC-20260728-WA0091.adding'),
    'D:\\koding\\app.ppmawar\\DOC-20260728-WA0091.adding',
    path.join(process.cwd(), '..', 'DOC-20260728-WA0091.adding'),
    path.join(process.cwd(), 'public', 'DOC-20260728-WA0091.adding'),
  ];
  return possiblePaths.find(p => fs.existsSync(p)) || null;
}

function parseSqlTuple(tupleStr: string): string[] {
  const cols: string[] = [];
  let col = '';
  let inStr = false;
  let esc = false;

  for (let i = 0; i < tupleStr.length; i++) {
    const c = tupleStr[i];
    if (esc) { col += c; esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === "'") { inStr = !inStr; continue; }
    if (c === ',' && !inStr) {
      cols.push(col.trim());
      col = '';
      continue;
    }
    col += c;
  }
  cols.push(col.trim());
  return cols;
}

function cleanVal(v: string | undefined): string {
  if (!v) return '';
  return v.replace(/^'|'$/g, '').trim();
}

// GET: Cek status ketersediaan file dump di server
export async function GET() {
  try {
    const dumpPath = getDumpPath();
    if (!dumpPath) {
      return NextResponse.json({
        success: true,
        availableOnServer: false,
        message: 'File dump server belum ditemukan. Anda dapat mengunggah file dump .sql secara manual.'
      });
    }

    const stat = fs.statSync(dumpPath);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(1);

    return NextResponse.json({
      success: true,
      availableOnServer: true,
      filename: path.basename(dumpPath),
      size: `${sizeMb} MB`,
      lastModified: stat.mtime
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Jalankan sinkronisasi data alumni dari file dump
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Hanya Admin atau Staff yang dapat melakukan sinkronisasi data alumni' }, { status: 403 });
    }

    // Pastikan kolom foto dan kategori_mukim ada di tabel alumni
    try {
      await pool.query("ALTER TABLE alumni ADD COLUMN foto VARCHAR(255) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE alumni ADD COLUMN kategori_mukim VARCHAR(50) DEFAULT 'PPM'");
    } catch (e) {}

    let inputStream: NodeJS.ReadableStream | null = null;
    let tempFilePath: string | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const os = await import('os');
        tempFilePath = path.join(os.tmpdir(), `dump_alumni_${Date.now()}.sql`);
        fs.writeFileSync(tempFilePath, buffer);
        inputStream = fs.createReadStream(tempFilePath);
      }
    }

    if (!inputStream) {
      const dumpPath = getDumpPath();
      if (!dumpPath) {
        return NextResponse.json({
          error: 'File dump database tidak ditemukan di server. Silakan gunakan opsi unggah file dump.'
        }, { status: 404 });
      }
      inputStream = fs.createReadStream(dumpPath);
    }

    // Ambil data alumni yang sudah ada di database untuk pemetaan cepat in-memory
    const [existingAlumni] = await pool.query<RowDataPacket[]>(
      'SELECT alumni_id, nis, LOWER(TRIM(nama)) as nama_lower FROM alumni'
    );
    const nisMap = new Map<string, number>();
    const nameMap = new Map<string, number>();
    for (const row of existingAlumni) {
      if (row.nis && String(row.nis).trim()) {
        nisMap.set(String(row.nis).trim(), row.alumni_id);
      }
      if (row.nama_lower) {
        nameMap.set(row.nama_lower, row.alumni_id);
      }
    }

    let totalSantriDump = 0;
    let totalAlumniFound = 0;
    let alumniAdded = 0;
    let alumniUpdated = 0;

    const rl = readline.createInterface({ input: inputStream });

    for await (const line of rl) {
      if (line.startsWith('INSERT INTO `santri` VALUES') || line.startsWith('INSERT INTO santri VALUES')) {
        let inStr = false;
        let escape = false;
        let tupleStart = -1;

        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (escape) { escape = false; continue; }
          if (c === '\\') { escape = true; continue; }
          if (c === "'") { inStr = !inStr; continue; }
          if (!inStr) {
            if (c === '(') {
              tupleStart = i + 1;
            } else if (c === ')' && tupleStart !== -1) {
              totalSantriDump++;
              const tupleStr = line.substring(tupleStart, i);
              const cols = parseSqlTuple(tupleStr);
              tupleStart = -1;

              if (cols.length < 28) continue;

              const nis = cleanVal(cols[3]);
              const nama = cleanVal(cols[7]);
              const tglMasuk = cleanVal(cols[1]);
              const tglBoyong = cleanVal(cols[2]);
              const nik = cleanVal(cols[6]);
              const genderRaw = cleanVal(cols[10]);
              const jenisKelamin = genderRaw === 'P' ? 'Perempuan' : 'Laki-laki';
              const dusun = cleanVal(cols[15]);
              const desa = cleanVal(cols[16]);
              const kecRaw = cleanVal(cols[17]);
              const kecamatan = kecRaw.includes('~') ? kecRaw.split('~')[1] : kecRaw;
              const kabRaw = cleanVal(cols[18]);
              const kabupaten = kabRaw.includes('~') ? kabRaw.split('~')[1] : kabRaw;
              const alamat = [dusun, desa, kecamatan ? `Kec. ${kecamatan}` : '', kabupaten ? `Kab. ${kabupaten}` : ''].filter(Boolean).join(', ');
              const fotoRaw = cleanVal(cols[24]);
              const foto = fotoRaw && fotoRaw !== '-' ? fotoRaw : null;
              const hpRaw = cleanVal(cols[25]);
              const noHp = hpRaw && hpRaw !== '0' ? hpRaw : null;
              const kamarRaw = cleanVal(cols[21]);
              const statusNum = parseInt(cleanVal(cols[27]), 10);

              const thnMasuk = tglMasuk && tglMasuk !== '0000-00-00' ? parseInt(tglMasuk.substring(0, 4), 10) : null;
              const thnKeluar = tglBoyong && tglBoyong !== '0000-00-00' ? parseInt(tglBoyong.substring(0, 4), 10) : 2026;

              const isAlumni = statusNum === 3 || statusNum === 4 || kamarRaw === 'BOYONG' || kamarRaw === 'DROPOUT';

              if (isAlumni && nama) {
                totalAlumniFound++;
                const statusKeluarStr = statusNum === 4 || kamarRaw === 'DROPOUT' ? 'Drop Out' : 'Lulus';
                const kategoriMukim = kamarRaw.toLowerCase().includes('lppm') ? 'LPPM' : 'PPM';

                const existingId = (nis && nisMap.get(nis)) || nameMap.get(nama.toLowerCase());

                if (existingId) {
                  await pool.execute(
                    `UPDATE alumni SET 
                      nama = ?, nis = ?, nik = ?, no_hp = ?, alamat = ?, foto = COALESCE(?, foto),
                      tahun_masuk = ?, tahun_keluar = ?, status_keluar = ?, jenis_kelamin = ?, kategori_mukim = ?
                    WHERE alumni_id = ?`,
                    [nama, nis || null, (nik && nik !== '0') ? nik : null, noHp, alamat || null, foto, thnMasuk, thnKeluar, statusKeluarStr, jenisKelamin, kategoriMukim, existingId]
                  );
                  alumniUpdated++;
                } else {
                  const [insResult]: any = await pool.execute(
                    `INSERT INTO alumni 
                      (nama, nis, nik, no_hp, alamat, foto, tahun_masuk, tahun_keluar, status_keluar, jenis_kelamin, kategori_mukim)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [nama, nis || null, (nik && nik !== '0') ? nik : null, noHp, alamat || null, foto, thnMasuk, thnKeluar, statusKeluarStr, jenisKelamin, kategoriMukim]
                  );
                  if (nis) nisMap.set(nis, insResult.insertId);
                  nameMap.set(nama.toLowerCase(), insResult.insertId);
                  alumniAdded++;
                }
              }
            }
          }
        }
      }
    }

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan data alumni mitra! (${totalAlumniFound} data alumni diproses: ${alumniAdded} ditambahkan, ${alumniUpdated} diperbarui).`,
      stats: {
        total_santri_dump: totalSantriDump,
        total_alumni: totalAlumniFound,
        alumni_ditambahkan: alumniAdded,
        alumni_diperbarui: alumniUpdated
      }
    });
  } catch (error: any) {
    console.error('Error sync mitra-dump:', error);
    return NextResponse.json({ error: 'Gagal menyinkronkan dump database: ' + error.message }, { status: 500 });
  }
}
