import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { setTelegramWebhook, getTelegramWebhookInfo, getTelegramConfig, DEFAULT_TELEGRAM_TOKEN } from '@/lib/services/telegramBot';

export const dynamic = 'force-dynamic';

/**
 * POST → Pasang webhook URL ke Telegram
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Admin yang dapat mengatur webhook Telegram' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    const config = await getTelegramConfig();
    const botToken = body.bot_token || config.botToken || DEFAULT_TELEGRAM_TOKEN;

    // Gunakan URL produksi PPMAWAR
    const webhookUrl = `https://app.ppmawar.or.id/api/telegram/webhook`;

    const result = await setTelegramWebhook(webhookUrl, botToken);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Webhook berhasil dipasang ke: ${webhookUrl}`,
        detail: result.message,
      });
    } else {
      return NextResponse.json({
        error: `Gagal memasang webhook: ${result.message}`,
      }, { status: 502 });
    }
  } catch (err: any) {
    console.error('[Set Webhook] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET → Cek status webhook yang sedang aktif
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const config = await getTelegramConfig();
    const info = await getTelegramWebhookInfo(config.botToken);

    return NextResponse.json({
      success: !!info?.ok,
      webhook_info: info?.result || null,
      is_active: !!(info?.result?.url),
      webhook_url: info?.result?.url || null,
      pending_updates: info?.result?.pending_update_count || 0,
      last_error: info?.result?.last_error_message || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
