import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { sendWaSchedule, getWaSchedulerConfig } from '@/lib/services/waScheduler';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload as any;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Hanya Admin/Staff yang dapat menjadwalkan pesan WA otomatis' }, { status: 403 });
    }

    const body = await request.json();
    const { phone_number, message, scheduled_time, is_loop, loop_interval } = body;

    if (!phone_number || !message) {
      return NextResponse.json({ error: 'phone_number dan message wajib diisi' }, { status: 400 });
    }

    const config = await getWaSchedulerConfig();

    const result = await sendWaSchedule({
      phone_number,
      message,
      scheduled_time: scheduled_time || new Date().toISOString().slice(0, 16),
      is_loop: is_loop !== undefined ? (is_loop ? 1 : 0) : config.isLoop,
      loop_interval: loop_interval || 'daily',
      apiKey: config.apiKey,
      endpoint: config.endpoint
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.message,
        data: result.data
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/wa-scheduler/send:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
