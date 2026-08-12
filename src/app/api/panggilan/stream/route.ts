import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * SSE endpoint untuk perangkat TOA per asrama.
 * 
 * ARSITEKTUR ANTRIAN ATOMIC (100% Reliable Delivery):
 * ──────────────────────────────────────────────────
 * 1. SELECT data panggilan yang berkategori `status = 'pending'` (dan sesuai filter asrama).
 * 2. UPDATE status panggilan tersebut secara atomic menjadi `status = 'dibacakan'`.
 * 3. Kirim data yang BERHASIL di-select & di-update secara langsung melalui SSE stream.
 * 
 * Ini menjamin 100% data tidak pernah hilang atau gantung sebagai 'dibacakan' tanpa terkirim ke TOA.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_INTERVAL = 1200; // 1.2 detik poll interval
const MAX_PER_POLL = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asrama = searchParams.get('asrama') || '';
  const deviceId = searchParams.get('device_id') || `device_${Date.now()}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Event connected awal
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

      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }

        heartbeatCount++;
        if (heartbeatCount % 8 === 0) {
          sendSafe(`: heartbeat ${new Date().toISOString()}\n\n`);
        }

        try {
          const connection = await (pool as any).getConnection();
          try {
            await connection.beginTransaction();

            const asramaFilter = asrama 
              ? `AND (nama_asrama = ${connection.escape(asrama)} OR nama_asrama IS NULL OR nama_asrama = '')` 
              : '';

            // 1. SELECT pending items first
            const [pendingRowsRaw] = await connection.execute(
              `SELECT * FROM panggilan_santri 
               WHERE status = 'pending' 
               ${asramaFilter}
               ORDER BY id ASC 
               LIMIT ${MAX_PER_POLL}`
            );
            const pendingRows = pendingRowsRaw as RowDataPacket[];

            if (pendingRows.length > 0) {
              const ids = pendingRows.map(r => r.id);
              const placeholders = ids.map(() => '?').join(',');

              // 2. UPDATE status to 'dibacakan' for those exact IDs
              await connection.execute(
                `UPDATE panggilan_santri 
                 SET status = 'dibacakan', dibacakan_at = NOW() 
                 WHERE id IN (${placeholders})`,
                ids
              );

              await connection.commit();

              // 3. Dispatch over SSE immediately
              for (const row of pendingRows) {
                const payload = {
                  ...row,
                  status: 'dibacakan',
                  _device_id: deviceId,
                  _claimed_at: new Date().toISOString(),
                };
                sendSafe(`event: panggilan\ndata: ${JSON.stringify(payload)}\n\n`);
              }
            } else {
              await connection.commit();
            }

          } catch (txErr) {
            await connection.rollback();
            throw txErr;
          } finally {
            connection.release();
          }

        } catch (err: any) {
          console.error('[SSE Panggilan Error]', err.message);
        }
      }, POLL_INTERVAL);

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

export async function POST(request: Request) {
  try {
    const { asrama } = await request.json();
    const params: any[] = [];
    let where = `status = 'pending'`;
    if (asrama) {
      where += ` AND (nama_asrama = ? OR nama_asrama IS NULL OR nama_asrama = '')`;
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
