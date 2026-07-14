import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getActivePendingReminders } from '@/lib/jadwal/activeReminders';

export const dynamic = 'force-dynamic';

export async function GET() {
  const noCacheHeaders = {
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noCacheHeaders });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noCacheHeaders });
    }

    const { role } = payload as any;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noCacheHeaders });
    }

    const reminders = await getActivePendingReminders();
    return NextResponse.json({ success: true, data: reminders }, { headers: noCacheHeaders });
  } catch (error: any) {
    console.error('Error fetching admin active reminders:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500, headers: noCacheHeaders });
  }
}
