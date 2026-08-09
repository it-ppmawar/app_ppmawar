import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * API untuk monitoring perangkat TOA yang sedang online per asrama.
 *
 * Perangkat TOA mengirim heartbeat ke sini setiap 30 detik.
 * Admin bisa melihat device mana yang online/offline.
 *
 * Tabel: panggilan_devices (dibuat otomatis oleh migrate)
 * - device_id   : unik per perangkat (generated saat buka halaman TOA)
 * - nama_asrama : nama asrama yang di-monitor
 * - last_seen   : timestamp heartbeat terakhir
 * - user_agent  : info browser/OS perangkat
 * - ip_address  : IP perangkat
 */

// GET — Daftar perangkat TOA: 1 perangkat terbaik per asrama, bersih dari entry lama
export async function GET() {
  try {
    // Pastikan tabel ada dulu
    await ensureDevicesTable();

    // Hapus otomatis perangkat yang tidak aktif lebih dari 24 jam (cleanup)
    try {
      await pool.execute(
        `DELETE FROM panggilan_devices WHERE last_seen < DATE_SUB(NOW(), INTERVAL 24 HOUR)`
      );
    } catch (_) {}

    // Ambil 1 perangkat terbaik per asrama (last_seen terbaru per nama_asrama)
    // Serta hitung status online/idle/offline berdasarkan selisih waktu
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         d.device_id,
         d.nama_asrama,
         d.last_seen,
         d.user_agent,
         TIMESTAMPDIFF(SECOND, d.last_seen, NOW()) as detik_sejak_terakhir,
         CASE 
           WHEN TIMESTAMPDIFF(SECOND, d.last_seen, NOW()) <= 60 THEN 'online'
           WHEN TIMESTAMPDIFF(SECOND, d.last_seen, NOW()) <= 300 THEN 'idle'
           ELSE 'offline'
         END as status
       FROM panggilan_devices d
       INNER JOIN (
         SELECT 
           COALESCE(nama_asrama, '__umum__') as asrama_key,
           MAX(last_seen) as max_seen
         FROM panggilan_devices
         GROUP BY COALESCE(nama_asrama, '__umum__')
       ) best 
         ON COALESCE(d.nama_asrama, '__umum__') = best.asrama_key 
         AND d.last_seen = best.max_seen
       ORDER BY 
         CASE 
           WHEN TIMESTAMPDIFF(SECOND, d.last_seen, NOW()) <= 60 THEN 1
           WHEN TIMESTAMPDIFF(SECOND, d.last_seen, NOW()) <= 300 THEN 2
           ELSE 3
         END ASC,
         d.nama_asrama ASC`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Heartbeat dari perangkat TOA
export async function POST(request: Request) {
  try {
    await ensureDevicesTable();

    const body = await request.json().catch(() => ({}));
    const { device_id, nama_asrama } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'device_id diperlukan' }, { status: 400 });
    }

    // Ambil info request
    const userAgent = request.headers.get('user-agent') || '';
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    // Upsert: update jika sudah ada, insert jika belum
    await pool.execute(
      `INSERT INTO panggilan_devices (device_id, nama_asrama, last_seen, user_agent, ip_address)
       VALUES (?, ?, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE
         nama_asrama = VALUES(nama_asrama),
         last_seen = NOW(),
         user_agent = VALUES(user_agent),
         ip_address = VALUES(ip_address)`,
      [device_id, nama_asrama || null, userAgent.substring(0, 300), ip]
    );

    // Cek antrian pending untuk asrama ini (info untuk perangkat)
    const queueFilter = nama_asrama ? `AND nama_asrama = ?` : '';
    const queueParams: any[] = nama_asrama ? [nama_asrama] : [];
    const [queueRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as pending FROM panggilan_santri WHERE status = 'pending' ${queueFilter}`,
      queueParams
    );

    return NextResponse.json({
      success: true,
      pong: true,
      server_time: new Date().toISOString(),
      pending_queue: (queueRows[0] as any)?.pending || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Hapus perangkat dari daftar (admin)
export async function DELETE(request: Request) {
  try {
    const { device_id } = await request.json();
    if (!device_id) return NextResponse.json({ error: 'device_id diperlukan' }, { status: 400 });

    await pool.execute('DELETE FROM panggilan_devices WHERE device_id = ?', [device_id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function ensureDevicesTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS panggilan_devices (
      device_id VARCHAR(100) PRIMARY KEY,
      nama_asrama VARCHAR(100),
      last_seen DATETIME NOT NULL,
      user_agent VARCHAR(300),
      ip_address VARCHAR(45),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_asrama (nama_asrama),
      INDEX idx_last_seen (last_seen)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
