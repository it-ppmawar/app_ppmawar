import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET() {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, tingkat, mata_pelajaran, kitab, keterangan FROM kurikulum_madin ORDER BY tingkat ASC, mata_pelajaran ASC'
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff yang dapat menambah kurikulum' }, { status: 403 });
    }

    const { tingkat, mata_pelajaran, kitab, keterangan } = await request.json();
    if (!tingkat || !mata_pelajaran || !kitab) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    await pool.execute(
      'INSERT INTO kurikulum_madin (tingkat, mata_pelajaran, kitab, keterangan) VALUES (?, ?, ?, ?)',
      [tingkat, mata_pelajaran, kitab, keterangan || null]
    );

    return NextResponse.json({ success: true, message: 'Kurikulum berhasil ditambahkan' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff yang dapat mengedit kurikulum' }, { status: 403 });
    }

    const { id, tingkat, mata_pelajaran, kitab, keterangan } = await request.json();
    if (!id || !tingkat || !mata_pelajaran || !kitab) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    await pool.execute(
      'UPDATE kurikulum_madin SET tingkat = ?, mata_pelajaran = ?, kitab = ?, keterangan = ? WHERE id = ?',
      [tingkat, mata_pelajaran, kitab, keterangan || null, id]
    );

    return NextResponse.json({ success: true, message: 'Kurikulum berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || (payload.role !== 'admin' && payload.role !== 'staff')) {
      return NextResponse.json({ error: 'Forbidden: Hanya admin/staff yang dapat menghapus kurikulum' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });

    await pool.execute('DELETE FROM kurikulum_madin WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Kurikulum berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
