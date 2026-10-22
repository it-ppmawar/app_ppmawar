import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || searchParams.get('t');

    if (!token) {
      return NextResponse.json({ error: 'Token presensi diperlukan' }, { status: 400 });
    }

    const payload = verifyToken(token) as any;
    if (!payload) {
      return NextResponse.json(
        { error: 'Tautan presensi tidak valid atau telah kedaluwarsa.' },
        { status: 401 }
      );
    }

    // Jika diakses langsung via browser (navigasi wali dari WA)
    const accept = request.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      const origin = new URL(request.url).origin;
      return NextResponse.redirect(`${origin}/rekapitulasi/preview?t=${encodeURIComponent(token)}`);
    }

    // Jika dipanggil via API JSON
    return NextResponse.json({
      success: true,
      valid: true,
      payload: {
        muridId: payload.muridId,
        tipe: payload.tipe,
        target_id: payload.target_id,
        sub_filter: payload.sub_filter,
        bulan: payload.bulan,
        tahun: payload.tahun,
        tanggal_dari: payload.tanggal_dari,
        tanggal_sampai: payload.tanggal_sampai,
        expires_at: payload.exp ? payload.exp * 1000 : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
