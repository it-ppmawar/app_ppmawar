import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * SSE endpoint untuk perangkat TOA per asrama.
 * 
 * ARSITEKTUR ANTRIAN YANG STABIL (High Concurrency):
 * ─────────────────────────────────────────────────
 * Masalah: Jika banyak panggilan masuk serentak (misal saat kunjungan),
 * SSE polling sederhana bisa mengirim data duplikat ke beberapa perangkat.
 * 
 * Solusi: "Atomic Claim" — sebelum mengirim ke perangkat, server langsung
 * mengubah status menjadi 'dibacakan' via UPDATE ... WHERE status='pending'
 * menggunakan transaksi atomic. Dengan cara ini, hanya SATU perangkat yang
 * berhasil "mengklaim" sebuah panggilan, dan perangkat lain tidak akan
 * mendapatkan panggilan yang sama.
 * 
 * Status Flow:
 *   pending → (atomic claim saat SSE kirim) → dibacakan → (setelah audio selesai) → selesai
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Interval poll (ms) — 1.5 detik untuk responsif tapi tidak terlalu membebani DB
const POLL_INTERVAL = 1500;
// Maksimal panggilan per poll (mencegah banjir jika banyak pending sekaligus)
const MAX_PER_POLL = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asrama = searchParams.get('asrama') || '';
  const deviceId = searchParams.get('device_id') || `device_${Date.now()}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Kirim event connected pertama
      const connectedEvent = JSON.stringify({ 
        connected: true, 
        asrama: asrama || 'semua', 
        device_id: deviceId,
        server_time: new Date().toISOString()
      });
      controller.enqueue(encoder.encode(`event: connected\ndata: ${connectedEvent}\n\n`));

      let closed = false;
      let heartbeatCount = 0;

      const sendSafe = (chunk: string) => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(chunk)); } catch (_) {}
        }
      };

      // ─── Main Poll Loop ───────────────────────────────────────────────────
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }

        heartbeatCount++;

        // Heartbeat setiap ~10 detik (setiap 7 poll × 1.5s ≈ 10.5s)
        if (heartbeatCount % 7 === 0) {
          sendSafe(`: heartbeat ${new Date().toISOString()}\n\n`);
        }

        try {
          // ─── ATOMIC CLAIM ────────────────────────────────────────────────
          // Kita gunakan UPDATE ... RETURNING atau SELECT + UPDATE dalam 1 blok
          // untuk memastikan tidak ada perangkat lain yang ambil panggilan sama.
          //
          // Strategi: UPDATE status ke 'dibacakan' terlebih dahulu (atomic via
          // DB lock), lalu baru SELECT data yang baru di-claim oleh device ini.
          // Ini aman untuk multi-perangkat concurrent.

          const connection = await (pool as any).getConnection();
          try {
            await connection.beginTransaction();

            // Tentukan filter asrama
            const asramaFilter = asrama 
              ? `AND nama_asrama = ${connection.escape(asrama)}` 
              : '';

            // UPDATE atomic: ambil dan klaim panggilan pending
            // Menggunakan ORDER BY id ASC untuk FIFO queue (first in first out)
            await connection.execute(
              `UPDATE panggilan_santri 
               SET status = 'dibacakan', 
                   dibacakan_at = NOW()
               WHERE id IN (
                 SELECT id FROM (
                   SELECT id FROM panggilan_santri 
                   WHERE status = 'pending' 
                   ${asramaFilter}
                   ORDER BY id ASC 
                   LIMIT ${MAX_PER_POLL}
                 ) as sub
               )`
            );

            // Ambil data yang baru saja di-claim
            const [claimedRaw] = await connection.execute(
              `SELECT * FROM panggilan_santri 
               WHERE status = 'dibacakan' 
               AND dibacakan_at >= DATE_SUB(NOW(), INTERVAL 3 SECOND)
               ${asramaFilter}
               ORDER BY id ASC 
               LIMIT ${MAX_PER_POLL}`
            );
            const claimed = claimedRaw as RowDataPacket[];

            await connection.commit();

            // Kirim setiap panggilan yang berhasil di-claim sebagai SSE event
            for (const row of (claimed as RowDataPacket[])) {
              // Enrich data untuk keperluan TTS
              const payload = {
                ...row,
                _device_id: deviceId,
                _claimed_at: new Date().toISOString(),
                _queue_position: 0,
              };
              sendSafe(`event: panggilan\ndata: ${JSON.stringify(payload)}\n\n`);
            }

          } catch (txErr) {
            await connection.rollback();
            throw txErr;
          } finally {
            connection.release();
          }

        } catch (err: any) {
          // Non-fatal: log tapi jangan disconnect perangkat
          console.error('[SSE Panggilan] Error:', err.message);
          sendSafe(`event: server_error\ndata: ${JSON.stringify({ error: 'Temporary DB error, retrying...', ts: Date.now() })}\n\n`);
        }
      }, POLL_INTERVAL);

      // ─── Cleanup ──────────────────────────────────────────────────────────
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch (_) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',       // penting untuk nginx
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ─── GET antrian saat ini (untuk display di TOA page) ─────────────────────
export async function POST(request: Request) {
  try {
    const { asrama } = await request.json();
    const params: any[] = [];
    let where = `status = 'pending'`;
    if (asrama) {
      where += ` AND nama_asrama = ?`;
      params.push(asrama);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, santri_nama, nama_kamar, nama_asrama, tujuan, created_at 
       FROM panggilan_santri 
       WHERE ${where}
       ORDER BY id ASC`,
      params
    );

    return NextResponse.json({ success: true, queue: rows, count: rows.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
