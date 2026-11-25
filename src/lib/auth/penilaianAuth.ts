import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { resolveToken } from '@/lib/auth/shortToken';

export interface PenilaianAuthResult {
  ok: true;
  payload: any;
  role: string;
  guruId: number | string | null;
  userId: number | string | null;
  muridId: number | string | null;
  username: string;
  isQuickToken: boolean;
}

export interface PenilaianAuthError {
  ok: false;
  error: string;
  status: number;
}

/**
 * Resolves authentication for penilaian endpoints from either a short/quick token
 * (query param, header, or request body) or the standard session JWT cookie.
 */
export async function resolvePenilaianAuth(
  request: Request,
  options?: {
    bodyToken?: string | null;
    allowedRoles?: string[];
  }
): Promise<PenilaianAuthResult | PenilaianAuthError> {
  const { searchParams } = new URL(request.url);
  const queryToken =
    options?.bodyToken ||
    searchParams.get('token') ||
    searchParams.get('t') ||
    request.headers.get('x-token');

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('token')?.value;

  let payload: any = null;
  let isQuickToken = false;

  if (queryToken) {
    payload = await resolveToken(queryToken);
    if (!payload) {
      return { ok: false, error: 'Token tidak valid', status: 401 };
    }
    if (payload.error) {
      return { ok: false, error: 'Token invalid atau kedaluwarsa', status: 401 };
    }
    // Tolak token pintasan yang bukan ditujukan untuk modul penginputan nilai
    if (payload.purpose && payload.purpose !== 'penilaian_input') {
      return { ok: false, error: 'Token tidak berlaku untuk modul penilaian', status: 403 };
    }
    isQuickToken = true;
  } else if (cookieToken) {
    payload = verifyToken(cookieToken);
    if (!payload) {
      return { ok: false, error: 'Token invalid', status: 401 };
    }
  } else {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  const role = String(payload.role || (isQuickToken ? 'guru' : '')).toLowerCase();
  if (options?.allowedRoles && !options.allowedRoles.includes(role)) {
    return { ok: false, error: 'Akses ditolak', status: 403 };
  }

  return {
    ok: true,
    payload,
    role,
    guruId: payload.guruId ?? payload.guru_id ?? null,
    userId: payload.userId ?? payload.user_id ?? null,
    muridId: payload.muridId ?? payload.murid_id ?? null,
    username: payload.username || '',
    isQuickToken,
  };
}
