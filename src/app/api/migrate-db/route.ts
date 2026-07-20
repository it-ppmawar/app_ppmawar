import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    let results = [];
    
    // Add kamar_id to users if it doesn't exist
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN kamar_id INT NULL');
      results.push('Added kamar_id to users');
    } catch (e: any) {
      results.push('users.kamar_id already exists or error: ' + e.message);
    }

    // Add barcode_id to murid
    try {
      await pool.execute('ALTER TABLE murid ADD COLUMN barcode_id VARCHAR(100) NULL');
      results.push('Added barcode_id to murid');
    } catch (e: any) {
      results.push('murid.barcode_id already exists or error: ' + e.message);
    }

    // Add barcode_id to guru
    try {
      await pool.execute('ALTER TABLE guru ADD COLUMN barcode_id VARCHAR(100) NULL');
      results.push('Added barcode_id to guru');
    } catch (e: any) {
      results.push('guru.barcode_id already exists or error: ' + e.message);
    }

    // Add kategori_mukim to alumni
    try {
      await pool.execute("ALTER TABLE alumni ADD COLUMN kategori_mukim ENUM('PPM','LPPM') NOT NULL DEFAULT 'PPM'");
      results.push('Added kategori_mukim to alumni');
    } catch (e: any) {
      results.push('alumni.kategori_mukim already exists or error: ' + e.message);
    }

    // Add is_pengasuh to users (for guru who also serve as pengasuh)
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN is_pengasuh TINYINT(1) NOT NULL DEFAULT 0');
      results.push('Added is_pengasuh to users');
    } catch (e: any) {
      results.push('users.is_pengasuh already exists or error: ' + e.message);
    }

    // Modify users.role enum to support all specialized roles
    try {
      await pool.execute("ALTER TABLE users MODIFY COLUMN role ENUM('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama','tamu','pengasuh','petugas_sarpras','petugas','petugas_umum','petugas_inventaris','petugas_inventaris_umum','petugas_kebersihan','petugas_kebersihan_umum') NOT NULL");
      results.push('✅ Updated users.role ENUM definition to support all new roles');
    } catch (e: any) {
      results.push('❌ Failed to update users.role ENUM: ' + e.message);
    }

    // Repair roles for seeded accounts that were set to empty/invalid string due to missing enum options
    try {
      const [fixPengasuh] = await pool.execute("UPDATE users SET role = 'pengasuh' WHERE (role = '' OR role IS NULL) AND username LIKE 'pengasuh_%'");
      const [fixInventaris] = await pool.execute("UPDATE users SET role = 'petugas_inventaris_umum' WHERE (role = '' OR role IS NULL) AND username = 'petugas_inventaris'");
      const [fixKebersihan] = await pool.execute("UPDATE users SET role = 'petugas_kebersihan_umum' WHERE (role = '' OR role IS NULL) AND username = 'petugas_kebersihan'");
      results.push(`✅ Fixed empty roles for seeded accounts: ${(fixPengasuh as any).affectedRows} pengasuh, ${(fixInventaris as any).affectedRows} petugas inventaris, ${(fixKebersihan as any).affectedRows} petugas kebersihan`);
    } catch (e: any) {
      results.push('❌ Failed to repair empty roles: ' + e.message);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
