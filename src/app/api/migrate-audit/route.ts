import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Buat tabel audit_log
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id           BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT,
        user_nama    VARCHAR(255),
        user_role    VARCHAR(50),
        aksi         VARCHAR(100),
        tabel        VARCHAR(50),
        record_id    INT,
        keterangan   TEXT,
        data_lama    JSON,
        data_baru    JSON,
        ip_address   VARCHAR(45),
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_created (created_at),
        INDEX idx_aksi (aksi)
      )
    `);

    // Buat tabel push_subscriptions
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT NOT NULL,
        user_role    VARCHAR(50),
        user_nama    VARCHAR(255),
        endpoint     TEXT NOT NULL,
        p256dh       TEXT NOT NULL,
        auth_key     TEXT NOT NULL,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_endpoint (user_id, endpoint(500))
      )
    `);

    return NextResponse.json({
      success: true,
      message: '✅ Tabel audit_log dan push_subscriptions berhasil dibuat/diverifikasi.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
