import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    const payload = token ? verifyToken(token) : null;
    
    if (!payload || ((payload as any).role !== 'admin' && (payload as any).role !== 'staff' && (payload as any).role !== 'guru' && (payload as any).role !== 'pengurus_asrama' && (payload as any).role !== 'pengasuh')) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { nis, barcode_id } = await request.json();

    if (!nis || !barcode_id) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Cek apakah barcode_id sudah dipakai orang lain
    const [existing] = await pool.execute<any[]>('SELECT murid_id, nama FROM murid WHERE barcode_id = ?', [barcode_id]);
    if (existing.length > 0) {
      // Jika yang punya barcode ini adalah orang yang berbeda
      const [currentMurid] = await pool.execute<any[]>('SELECT murid_id FROM murid WHERE nis = ?', [nis]);
      if (currentMurid.length > 0 && currentMurid[0].murid_id !== existing[0].murid_id) {
        return NextResponse.json({ error: `Barcode ini sudah terdaftar milik santri: ${existing[0].nama}` }, { status: 400 });
      }
    }

    // Update barcode_id berdasarkan NIS
    const [result] = await pool.execute<any>(
      'UPDATE murid SET barcode_id = ? WHERE nis = ?',
      [barcode_id, nis]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Santri dengan NIS tersebut tidak ditemukan' }, { status: 404 });
    }

    // Ambil data terbaru untuk konfirmasi UI
    const [updated] = await pool.execute<any[]>('SELECT nama, kelas_madin_id, kelas_quran_id FROM murid WHERE nis = ?', [nis]);

    return NextResponse.json({ 
      success: true, 
      message: 'Kartu berhasil dipasangkan!',
      murid: updated[0] 
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
