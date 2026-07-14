import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logout berhasil' });
  
  // Hapus cookie
  const cookieStore = await cookies();
  cookieStore.delete('token');

  return response;
}
