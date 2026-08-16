import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

const WA_BASE = 'https://wa.quizb.my.id';
const WA_USERNAME = 'gusimad';
const WA_PASSWORD = '123';

/**
 * Login ke wa.quizb.my.id dan kembalikan session cookie string.
 * Login membutuhkan CSRF token yang diambil dari halaman login terlebih dahulu.
 */
async function loginWaScheduler(): Promise<string | null> {
  try {
    // Step 1: Ambil CSRF token dari halaman login
    const loginPageRes = await fetch(`${WA_BASE}/login.php`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const loginPageHtml = await loginPageRes.text();
    const csrfMatch = loginPageHtml.match(/csrf_token[^>]*value="([^"]+)"/);
    if (!csrfMatch) return null;
    const csrfToken = csrfMatch[1];

    // Ambil cookie dari response login page
    const loginPageCookies = loginPageRes.headers.getSetCookie?.() ?? 
      (loginPageRes.headers.get('set-cookie') ? [loginPageRes.headers.get('set-cookie')!] : []);
    const sessionCookieRaw = loginPageCookies.find(c => c.startsWith('PHPSESSID='));
    const sessionId = sessionCookieRaw?.split(';')[0] || '';

    // Step 2: POST login dengan CSRF token
    const loginRes = await fetch(`${WA_BASE}/login.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': sessionId,
        'User-Agent': 'Mozilla/5.0',
      },
      body: new URLSearchParams({
        csrf_token: csrfToken,
        username: WA_USERNAME,
        password: WA_PASSWORD,
      }).toString(),
      redirect: 'manual',
    });

    // Ambil cookie baru dari respons login
    const loginCookies = loginRes.headers.getSetCookie?.() ?? 
      (loginRes.headers.get('set-cookie') ? [loginRes.headers.get('set-cookie')!] : []);
    
    // Gabungkan semua cookie yang relevan
    const allCookies = [...loginPageCookies, ...loginCookies]
      .map(c => c.split(';')[0])
      .filter(Boolean)
      .join('; ');

    return allCookies || null;
  } catch {
    return null;
  }
}

/**
 * Ambil daftar semua scheduled message (pending) dari wa.quizb.my.id
 */
async function fetchPendingSchedules(sessionCookie: string): Promise<{ id: string; status: string }[]> {
  const res = await fetch(`${WA_BASE}/api/schedules.php?page=1&limit=1000`, {
    method: 'GET',
    headers: {
      'Cookie': sessionCookie,
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data) return [];
  // Respons bisa berupa { data: [...] } atau array langsung
  const rows: any[] = Array.isArray(data) ? data : (data.data ?? data.schedules ?? []);
  return rows
    .filter((r: any) => (r.status ?? '').toLowerCase() === 'pending')
    .map((r: any) => ({ id: String(r.id), status: r.status }));
}

/**
 * DELETE satu jadwal berdasarkan ID
 */
async function deleteSchedule(id: string, sessionCookie: string): Promise<boolean> {
  try {
    const res = await fetch(`${WA_BASE}/api/schedules.php`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => null);
    return data?.status === 'success';
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalid' }, { status: 401 });

    const { role } = payload as any;
    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Hanya Admin/Staff yang dapat menghapus antrean' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    // status_filter: 'pending' (default) | 'all'
    const statusFilter: string = body.status_filter ?? 'pending';

    // Step 1: Login ke wa.quizb.my.id
    const sessionCookie = await loginWaScheduler();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Gagal login ke wa.quizb.my.id. Periksa kredensial.' }, { status: 502 });
    }

    // Step 2: Ambil daftar pending schedules
    const schedules = await fetchPendingSchedules(sessionCookie);
    if (schedules.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Tidak ada antrean pending yang ditemukan.',
        deleted: 0, 
        failed: 0 
      });
    }

    // Step 3: Hapus semua secara parallel (chunk 10)
    const chunkSize = 10;
    let deleted = 0;
    let failed = 0;
    const failedIds: string[] = [];

    for (let i = 0; i < schedules.length; i += chunkSize) {
      const chunk = schedules.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(s => deleteSchedule(s.id, sessionCookie))
      );
      results.forEach((ok, idx) => {
        if (ok) deleted++;
        else { failed++; failedIds.push(chunk[idx].id); }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus ${deleted} antrean pending.${failed > 0 ? ` Gagal: ${failed} item (ID: ${failedIds.slice(0, 5).join(', ')}${failedIds.length > 5 ? '...' : ''}).` : ''}`,
      deleted,
      failed,
      total_found: schedules.length,
    });

  } catch (err: any) {
    console.error('[wa-scheduler/clear-pending] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Terjadi kesalahan server' }, { status: 500 });
  }
}
