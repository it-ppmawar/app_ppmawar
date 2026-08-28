import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  // Decode token untuk mendapatkan info user SEBELUM dihapus
  let userId = 0;
  let userNama = 'Unknown';
  let userRole = 'unknown';
  if (token) {
    try {
      const payload = verifyToken(token) as any;
      if (payload) {
        userId = payload.userId || 0;
        userNama = payload.nama || payload.username || 'Unknown';
        userRole = payload.role || 'unknown';
      }
    } catch (_) {}
  }

  const response = NextResponse.json({ success: true, message: 'Logout berhasil' });
  
  // Hapus cookie
  cookieStore.delete('token');

  // Catat aksi logout ke audit log (fire-and-forget)
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '';
  logAudit({
    userId,
    userNama,
    userRole,
    aksi: 'logout',
    tabel: 'users',
    recordId: userId || null,
    keterangan: `Logout dari sistem (role: ${userRole})`,
    ipAddress,
  }).catch(() => {});

  return response;
}
