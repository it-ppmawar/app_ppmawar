import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { sendTelegramMessage, getTelegramBotInfo, getTelegramConfig, DEFAULT_TELEGRAM_TOKEN } from '@/lib/services/telegramBot';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token) as any;
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Admin yang dapat menguji Telegram Bot' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { chat_id, message, bot_token } = body;

    if (!chat_id) {
      return NextResponse.json({ error: 'chat_id wajib diisi' }, { status: 400 });
    }

    const config = await getTelegramConfig();
    const effectiveToken = bot_token || config.botToken || DEFAULT_TELEGRAM_TOKEN;

    // Cek info bot terlebih dahulu
    const botInfo = await getTelegramBotInfo(effectiveToken);
    if (!botInfo?.ok) {
      return NextResponse.json({
        error: 'Token Telegram tidak valid atau bot tidak aktif: ' + (botInfo?.description || 'Unknown error')
      }, { status: 400 });
    }

    const testMessage = message || (
      `🧪 <b>Uji Coba Notifikasi PPMAWAR</b>\n\n` +
      `Assalamu'alaikum! Ini adalah pesan uji coba dari sistem notifikasi\n` +
      `<b>Pondok Pesantren Matholi'ul Anwar (PPMA)</b>.\n\n` +
      `✅ Koneksi Telegram Bot berhasil!\n` +
      `🤖 Bot: @${botInfo.result?.username || config.botUsername}\n` +
      `⏰ Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n` +
      `_Sistem Notifikasi PPMAWAR siap digunakan._`
    );

    const result = await sendTelegramMessage({
      chat_id,
      text: testMessage,
      parse_mode: 'HTML',
      botToken: effectiveToken,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Pesan uji coba berhasil dikirim ke chat_id: ${chat_id}`,
        bot_info: {
          username: botInfo.result?.username,
          first_name: botInfo.result?.first_name,
          id: botInfo.result?.id,
        }
      });
    } else {
      return NextResponse.json({
        error: result.message || 'Gagal mengirim pesan uji coba',
        bot_info: {
          username: botInfo.result?.username,
        }
      }, { status: 502 });
    }
  } catch (err: any) {
    console.error('[Telegram Test] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

/**
 * GET → Cek info bot (getMe)
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
    const botInfo = await getTelegramBotInfo(config.botToken);

    return NextResponse.json({
      success: !!botInfo?.ok,
      bot_info: botInfo?.result || null,
      config: {
        bot_username: config.botUsername,
        notification_mode: config.notificationMode,
        kepala_madin_putra_chat_id: config.kepalaMainPutraChatId ? '✅ Terdaftar' : '⚪ Belum diatur',
        kepala_madin_putri_chat_id: config.kepalaMainPutriChatId ? '✅ Terdaftar' : '⚪ Belum diatur',
      },
      error: botInfo?.ok ? undefined : (botInfo?.description || 'Bot tidak dapat dihubungi'),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
