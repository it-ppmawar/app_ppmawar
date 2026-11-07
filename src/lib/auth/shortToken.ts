import crypto from 'crypto';
import zlib from 'zlib';
import pool from '@/lib/db';
import { verifyToken, signToken } from '@/lib/auth/jwt';
import { RowDataPacket } from 'mysql2';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_absensi_123';
const CHARSET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'; // 56 readable chars (no 0, 1, i, l, o)

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS app_short_tokens (
        token VARCHAR(32) NOT NULL PRIMARY KEY,
        type VARCHAR(50) NOT NULL DEFAULT '',
        payload MEDIUMTEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tableEnsured = true;
  } catch (err) {
    // If table creation fails (e.g. offline dev without local DB), allow fallback
    console.warn('ensureTable app_short_tokens warning:', (err as any)?.message);
  }
}

function generateRandomCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

function parseExpiryMs(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn * 1000;
  }
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

function formatWibDateTime(date: Date): string {
  // Format YYYY-MM-DD HH:mm:ss sesuai zona waktu Asia/Jakarta (WIB) untuk MySQL DATETIME
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
  return parts.replace('T', ' ');
}

/**
 * Buat compact stateless signed token jika database tidak tersedia (fallback).
 * Format: s_<base64url_compressed_json>_<base64url_hmac_12bytes>
 */
function createCompactStatelessToken(payload: any, expiresIn: string | number): string {
  const expiryMs = parseExpiryMs(expiresIn);
  const expTimestamp = Math.floor((Date.now() + expiryMs) / 1000);
  const payloadWithExp = { ...payload, exp: expTimestamp };
  
  const jsonStr = JSON.stringify(payloadWithExp);
  const compressed = zlib.deflateRawSync(Buffer.from(jsonStr, 'utf-8'));
  const payloadB64 = compressed.toString('base64url');
  
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(`s_${payloadB64}`);
  const sig = hmac.digest().subarray(0, 12).toString('base64url'); // 12 bytes = 16 base64 chars
  
  return `s_${payloadB64}_${sig}`;
}

/**
 * Verifikasi compact stateless signed token.
 */
function verifyCompactStatelessToken(token: string): any | null {
  try {
    const parts = token.split('_');
    if (parts.length !== 3 || parts[0] !== 's') return null;
    const payloadB64 = parts[1];
    const signature = parts[2];
    
    const hmac = crypto.createHmac('sha256', JWT_SECRET);
    hmac.update(`s_${payloadB64}`);
    const expectedSig = hmac.digest().subarray(0, 12).toString('base64url');
    
    if (signature !== expectedSig) return null;
    
    const compressed = Buffer.from(payloadB64, 'base64url');
    const decompressed = zlib.inflateRawSync(compressed);
    const parsed = JSON.parse(decompressed.toString('utf-8'));
    
    if (parsed.exp && parsed.exp * 1000 < Date.now()) {
      return null; // Expired
    }
    
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Buat token pendek ringkas (8 karakter).
 * Disimpan di MySQL app_short_tokens, dengan fallback stateless jika DB tidak tersedia.
 */
export async function createShortToken(
  payload: any,
  expiresIn: string | number = '7d',
  type: string = ''
): Promise<string> {
  const expiryMs = parseExpiryMs(expiresIn);
  const expTimestamp = Math.floor((Date.now() + expiryMs) / 1000);
  const payloadWithExp = { ...(payload || {}), exp: expTimestamp };

  const expiryDate = new Date(Date.now() + expiryMs);
  const expiryStr = formatWibDateTime(expiryDate);

  try {
    await ensureTable();
    let token = generateRandomCode(8);

    // Cek kemungkinan duplikasi (sangat kecil kemungkinannya)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await pool.execute(
          'INSERT INTO app_short_tokens (token, type, payload, expires_at) VALUES (?, ?, ?, ?)',
          [token, type, JSON.stringify(payloadWithExp), expiryStr]
        );
        
        // Pembersihan background (peluang 5%)
        if (Math.random() < 0.05) {
          pool.execute('DELETE FROM app_short_tokens WHERE expires_at < NOW() - INTERVAL 1 DAY').catch(() => {});
        }
        
        return token;
      } catch (insertErr: any) {
        if (insertErr.code === 'ER_DUP_ENTRY') {
          token = generateRandomCode(8);
          continue;
        }
        throw insertErr;
      }
    }
  } catch (err: any) {
    console.warn('Gagal simpan short token ke database, menggunakan compact stateless token:', err?.message);
  }

  // Fallback: compact stateless token
  return createCompactStatelessToken(payload, expiresIn);
}

/**
 * Buat token pendek secara batch (misal untuk baris rekapitulasi massal).
 * Menggunakan 1 query multi-insert MySQL yang sangat cepat.
 */
export async function createShortTokensBatch(
  items: { payload: any; expiresIn?: string | number; type?: string }[]
): Promise<string[]> {
  if (!items || items.length === 0) return [];

  try {
    await ensureTable();
    const tokens: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];

    for (const item of items) {
      const token = generateRandomCode(8);
      tokens.push(token);
      const expiryMs = parseExpiryMs(item.expiresIn || '7d');
      const expTimestamp = Math.floor((Date.now() + expiryMs) / 1000);
      const payloadWithExp = { ...(item.payload || {}), exp: expTimestamp };
      const expiryDate = new Date(Date.now() + expiryMs);
      const expiryStr = formatWibDateTime(expiryDate);

      placeholders.push('(?, ?, ?, ?)');
      values.push(token, item.type || '', JSON.stringify(payloadWithExp), expiryStr);
    }

    const query = `INSERT INTO app_short_tokens (token, type, payload, expires_at) VALUES ${placeholders.join(', ')}`;
    await pool.execute(query, values);

    // Pembersihan background berkala
    if (Math.random() < 0.05) {
      pool.execute('DELETE FROM app_short_tokens WHERE expires_at < NOW() - INTERVAL 1 DAY').catch(() => {});
    }

    return tokens;
  } catch (err: any) {
    console.warn('Gagal batch insert short token, menggunakan fallback token:', err?.message);
    return items.map(item => createCompactStatelessToken(item.payload, item.expiresIn || '7d'));
  }
}

/**
 * Resolusi & verifikasi token serbaguna:
 * 1. Mendukung token pendek (8-16 char) dari tabel MySQL app_short_tokens.
 * 2. Mendukung token stateless compact (format s_...).
 * 3. Mendukung token JWT warisan (format eyJ...) untuk kompatibilitas tautan lama 100%.
 */
export async function resolveToken(tokenStr: string | null | undefined): Promise<any | null> {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  const trimmed = tokenStr.trim();
  if (!trimmed) return null;

  // 1. Cek format stateless compact
  if (trimmed.startsWith('s_')) {
    return verifyCompactStatelessToken(trimmed);
  }

  // 2. Cek format JWT klasik (memiliki 2 titik atau diawali eyJ)
  if (trimmed.startsWith('eyJ') || (trimmed.match(/\./g) || []).length === 2) {
    return verifyToken(trimmed);
  }

  // 3. Cek format token pendek di tabel app_short_tokens
  try {
    await ensureTable();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT payload, expires_at FROM app_short_tokens WHERE token = ? LIMIT 1',
      [trimmed]
    );

    if (rows && rows.length > 0) {
      const row = rows[0];

      let parsedPayload: any = {};
      try {
        parsedPayload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      } catch (e) {
        parsedPayload = {};
      }

      // Hitung expiryTime (dalam millisecond epoch)
      let expiryTime = 0;
      if (parsedPayload && typeof parsedPayload.exp === 'number' && parsedPayload.exp > 0) {
        // Prioritas 1: payload.exp (epoch seconds murni tanpa ketergantungan timezone)
        expiryTime = parsedPayload.exp * 1000;
      } else if (row.expires_at) {
        // Prioritas 2: row.expires_at dari MySQL
        if (row.expires_at instanceof Date) {
          // mysql2 mengonstruksi local Date dari nilai YYYY-MM-DD HH:mm:ss.
          // Untuk backward-compatibility token yang sebelumnya tersimpan via toISOString (UTC),
          // kita bandingkan interpretasi UTC vs Local dan ambil nilai yang lebih besar agar tidak prematur kadaluarsa.
          const asUtc = Date.UTC(
            row.expires_at.getFullYear(),
            row.expires_at.getMonth(),
            row.expires_at.getDate(),
            row.expires_at.getHours(),
            row.expires_at.getMinutes(),
            row.expires_at.getSeconds()
          );
          const asLocal = row.expires_at.getTime();
          expiryTime = Math.max(asUtc, asLocal);
        } else {
          const str = String(row.expires_at).trim();
          const cleanStr = str.replace(' ', 'T');
          const asUtc = new Date(cleanStr.endsWith('Z') ? cleanStr : `${cleanStr}Z`).getTime();
          const asLocal = new Date(cleanStr).getTime();
          expiryTime = Math.max(isNaN(asUtc) ? 0 : asUtc, isNaN(asLocal) ? 0 : asLocal);
        }
      }

      // Berikan grace period 15 menit agar toleran terhadap sedikit pergeseran jam
      if (expiryTime > 0 && expiryTime + 15 * 60 * 1000 < Date.now()) {
        return null; // Token kedaluwarsa
      }

      // Pastikan properti exp disertakan agar kompatibel dengan kode yang membaca payload.exp
      if (!parsedPayload.exp && expiryTime > 0) {
        parsedPayload.exp = Math.floor(expiryTime / 1000);
      }

      return parsedPayload;
    }
  } catch (err: any) {
    console.warn('Gagal mencari short token di DB:', err?.message);
  }

  // Sebagai fallback terakhir jika token ternyata jwt tanpa titik standar
  return verifyToken(trimmed);
}
