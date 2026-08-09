import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

// GET — Daftar semua format panggilan (semua user yang login bisa akses)
export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM format_panggilan WHERE aktif = 1 ORDER BY urutan ASC, id ASC'
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Buat format baru (admin/staff only)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { nama, bahasa, jenis_suara, template, urutan } = await request.json();
    if (!nama || !template) {
      return NextResponse.json({ error: 'nama dan template wajib diisi' }, { status: 400 });
    }

    const [result]: any = await pool.execute(
      'INSERT INTO format_panggilan (nama, bahasa, jenis_suara, template, urutan) VALUES (?, ?, ?, ?, ?)',
      [nama, bahasa || 'id', jenis_suara || 'auto', template, urutan || 0]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — Update format (admin/staff only)
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id, nama, bahasa, jenis_suara, template, urutan, aktif } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

    await pool.execute(
      'UPDATE format_panggilan SET nama=?, bahasa=?, jenis_suara=?, template=?, urutan=?, aktif=? WHERE id=?',
      [nama, bahasa || 'id', jenis_suara || 'auto', template, urutan || 0, aktif !== undefined ? aktif : 1, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Hapus format (admin/staff only)
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token) as any;
    if (!payload || !['admin', 'staff'].includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

    await pool.execute('DELETE FROM format_panggilan WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
