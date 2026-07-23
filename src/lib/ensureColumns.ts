import pool from '@/lib/db';

let isEnsured = false;

export async function ensureUserColumns() {
  if (isEnsured) return;

  const columns = [
    'ALTER TABLE users ADD COLUMN is_pengasuh TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN is_pengurus_asrama TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN asrama VARCHAR(50) NULL',
    'ALTER TABLE users ADD COLUMN kamar_id INT NULL'
  ];

  for (const sql of columns) {
    try {
      await pool.execute(sql);
    } catch (e) {
      // Ignore if column already exists
    }
  }

  isEnsured = true;
}
