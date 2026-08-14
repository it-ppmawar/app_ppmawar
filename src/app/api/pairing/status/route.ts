import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/pairing/status
 * Mengembalikan daftar santri lengkap dengan status pairing kartu QR/Barcode dan statistik
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jenis_kelamin = searchParams.get('jenis_kelamin');
    const kelas_madin_id = searchParams.get('kelas_madin_id');

    let sql = `
      SELECT
        m.murid_id,
        m.nama,
        m.nis,
        m.jenis_kelamin,
        m.foto,
        m.barcode_id,
        km.nama_kelas AS kelas_madin,
        CASE WHEN m.barcode_id IS NOT NULL AND TRIM(m.barcode_id) != '' THEN 1 ELSE 0 END AS paired
      FROM murid m
      LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (jenis_kelamin) {
      sql += ' AND m.jenis_kelamin = ?';
      params.push(jenis_kelamin);
    }

    if (kelas_madin_id) {
      sql += ' AND m.kelas_madin_id = ?';
      params.push(Number(kelas_madin_id));
    }

    sql += ' ORDER BY m.nama ASC';

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);

    // Cek ketersediaan folder lokal KARTU EMAAL 2026 2027
    const emaalDir = path.join(process.cwd(), 'KARTU EMAAL 2026 2027');
    const hasEmaalDir = fs.existsSync(emaalDir);

    const data = rows.map((r) => {
      let fotoUrl: string | null = null;

      if (r.foto && r.foto !== '-' && r.foto.trim() !== '') {
        if (r.foto.startsWith('http://') || r.foto.startsWith('https://')) {
          fotoUrl = r.foto;
        } else if (
          r.foto.startsWith('foto_') ||
          r.foto.startsWith('upload_') ||
          r.foto.startsWith('profil_')
        ) {
          fotoUrl = `/uploads/${r.foto}`;
        } else {
          const clean = r.foto.startsWith('/') ? r.foto.substring(1) : r.foto;
          fotoUrl = `https://mawar.smartpesantren.id/sekretariat/berkas/${clean}`;
        }
      }

      // Jika belum ada fotoUrl tapi punya NIS dan ada file kartu lokal
      if (!fotoUrl && r.nis) {
        if (hasEmaalDir && fs.existsSync(path.join(emaalDir, `${r.nis}.jpg`))) {
          fotoUrl = `/api/kartu-image/${r.nis}`;
        }
      }

      return {
        murid_id: r.murid_id,
        nama: r.nama,
        nis: r.nis,
        jenis_kelamin: r.jenis_kelamin,
        foto: fotoUrl,
        barcode_id: r.barcode_id || null,
        kelas_madin: r.kelas_madin || null,
        paired: r.paired === 1,
      };
    });

    const total = data.length;
    const paired = data.filter((d) => d.paired).length;
    const unpaired = total - paired;
    const percent = total > 0 ? Math.round((paired / total) * 100) : 0;

    const putraList = data.filter((d) => d.jenis_kelamin === 'Laki-laki');
    const putriList = data.filter((d) => d.jenis_kelamin === 'Perempuan');

    const putraPaired = putraList.filter((d) => d.paired).length;
    const putriPaired = putriList.filter((d) => d.paired).length;

    return NextResponse.json({
      success: true,
      stats: {
        total,
        paired,
        unpaired,
        percent,
        putra: {
          total: putraList.length,
          paired: putraPaired,
          unpaired: putraList.length - putraPaired,
          percent:
            putraList.length > 0
              ? Math.round((putraPaired / putraList.length) * 100)
              : 0,
        },
        putri: {
          total: putriList.length,
          paired: putriPaired,
          unpaired: putriList.length - putriPaired,
          percent:
            putriList.length > 0
              ? Math.round((putriPaired / putriList.length) * 100)
              : 0,
        },
      },
      data,
    });
  } catch (error: any) {
    console.error('pairing/status error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
