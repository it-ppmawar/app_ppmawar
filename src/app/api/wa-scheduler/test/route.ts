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

    const { role, username } = payload as any;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Hanya Admin/Staff yang dapat melakukan uji coba WA Scheduler' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { phone_number, apiKey, customMessage } = body;

    const config = await getWaSchedulerConfig();
    const targetPhone = phone_number || '6281234567890';
    const activeApiKey = apiKey || config.apiKey;

    const now = new Date();
    // Jadwalkan 2 menit dari sekarang agar antrean langsung dapat diproses
    const testDate = new Date(now.getTime() + 2 * 60 * 1000);
    const y = testDate.getFullYear();
    const m = String(testDate.getMonth() + 1).padStart(2, '0');
    const d = String(testDate.getDate()).padStart(2, '0');
    const h = String(testDate.getHours()).padStart(2, '0');
    const min = String(testDate.getMinutes()).padStart(2, '0');
    const scheduledTime = `${y}-${m}-${d}T${h}:${min}`;

    const testMessage = customMessage || `[Tes Integrasi PP Mawar]\n\nAssalamu'alaikum Warohmatullah,\nIni adalah pesan uji coba integrasi WhatsApp Scheduler otomatis dari aplikasi Absensi PP Mawar untuk pengujian akun (${username || 'Admin'}).\n\nWaktu Kirim: ${scheduledTime}\nStatus: Berhasil Terhubung!`;

    const result = await sendWaSchedule({
      phone_number: targetPhone,
      message: testMessage,
      scheduled_time: scheduledTime,
      is_loop: 0,
      apiKey: activeApiKey,
      endpoint: config.endpoint
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Pesan tes berhasil dikirim ke antrean WA Scheduler!',
        scheduled_time: scheduledTime,
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
    console.error('Error in /api/wa-scheduler/test:', error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
