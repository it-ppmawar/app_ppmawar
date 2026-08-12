import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * SSE endpoint untuk perangkat TOA per asrama.
 *
 * ARSITEKTUR RELIABLE DELIVERY:
 * ─────────────────────────────
 * 1. AUTO-RECOVERY: Panggilan yang stuck di 'dibacakan' > 8 detik (artinya SSE delivery gagal)
 *    secara otomatis di-reset ke 'pending' untuk diclaim ulang.
 * 2. ATOMIC SELECT-THEN-UPDATE: SELECT pending dulu, lalu UPDATE exact ID-nya,
 *    sehingga tidak ada data yang ter-skip atau di-kirim ganda.
 * 3. IMMEDIATE DISPATCH: Data langsung dikirim via SSE setelah claim berhasil.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_INTERVAL = 1500; // 1.5 detik poll
const MAX_PER_POLL = 3;
const STALE_DIBACAKAN_SECONDS = 8; // reset ke pending jika SSE delivery gagal

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asrama   = searchParams.get('asrama') || '';
  const deviceId = searchParams.get('device_id') || `device_${Date.now()}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Event 'connected' pertama
      controller.enqueue(encoder.encode(
        `event: connected\ndata: ${JSON.stringify({
          connected: true,
          asrama: asrama || 'semua',
          device_id: deviceId,
          server_time: new Date().toISOString(),
        })}\n\n`
      ));

      let closed       = false;
      let heartbeatCnt = 0;

      const sendSafe = (chunk: string) => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(chunk)); } catch (_) {}
        }
      };

      // ─── Main Poll Loop ──────────────────────────────────────────────────
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }

        heartbeatCnt++;
        if (heartbeatCnt % 8 === 0) {
          sendSafe(`: heartbeat ${new Date().toISOString()}\n\n`);
        }

        let connection;
        try {
          connection = await (pool as any).getConnection();
          await connection.beginTransaction();

          // ── STEP 1: Auto-recovery ──────────────────────────────────────
          // Reset panggilan yang stuck di 'dibacakan' terlalu lama
          // (artinya SSE delivery gagal karena koneksi terputus sesaat)
          await connection.execute(
            `UPDATE panggilan_santri
             SET status = 'pending', dibacakan_at = NULL
             WHERE status = 'dibacakan'
               AND dibacakan_at < DATE_SUB(NOW(), INTERVAL ${STALE_DIBACAKAN_SECONDS} SECOND)
               AND DATE(created_at) = CURDATE()`
          );

          // ── STEP 2: Build asrama filter ────────────────────────────────
          // TOA "Semua Asrama" (asrama kosong) → ambil semua asrama
          // TOA asrama spesifik → hanya ambil yang asramanya cocok
          const asramaWhere = asrama
            ? `AND nama_asrama = ${connection.escape(asrama)}`
            : '';

          // ── STEP 3: SELECT pending (FIFO) ──────────────────────────────
          const [pendingRaw] = await connection.execute(
            `SELECT * FROM panggilan_santri
             WHERE status = 'pending'
             ${asramaWhere}
             ORDER BY id ASC
             LIMIT ${MAX_PER_POLL}`
          );
          const pending = pendingRaw as RowDataPacket[];

          if (pending.length > 0) {
            const ids          = pending.map((r: any) => r.id);
            const placeholders = ids.map(() => '?').join(',');

            // ── STEP 4: UPDATE exact IDs → 'dibacakan' ─────────────────
            await connection.execute(
              `UPDATE panggilan_santri
               SET status = 'dibacakan', dibacakan_at = NOW()
               WHERE id IN (${placeholders})`,
              ids
            );

            await connection.commit();

            // ── STEP 5: Dispatch ke SSE ─────────────────────────────────
            for (const row of pending) {
              sendSafe(
                `event: panggilan\ndata: ${JSON.stringify({
                  ...row,
                  status: 'dibacakan',
                  _device_id: deviceId,
                  _claimed_at: new Date().toISOString(),
                })}\n\n`
              );
            }
          } else {
            await connection.commit();
          }

        } catch (err: any) {
          if (connection) {
            try { await connection.rollback(); } catch (_) {}
          }
          console.error('[SSE Panggilan Error]', err.message);
        } finally {
          if (connection) connection.release();
        }
      }, POLL_INTERVAL);

      // ─── Cleanup saat klien disconnect ──────────────────────────────────
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
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ─── GET antrian saat ini ──────────────────────────────────────────────────
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
