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

    // Add is_pengurus_asrama to users (for guru who also serve as pengurus asrama)
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN is_pengurus_asrama TINYINT(1) NOT NULL DEFAULT 0');
      results.push('Added is_pengurus_asrama to users');
    } catch (e: any) {
      results.push('users.is_pengurus_asrama already exists or error: ' + e.message);
    }

    // Add asrama to users (for double-role guru assigned to specific dorm)
    try {
      await pool.execute('ALTER TABLE users ADD COLUMN asrama VARCHAR(50) NULL');
      results.push('Added asrama to users');
    } catch (e: any) {
      results.push('users.asrama already exists or error: ' + e.message);
    }

    // Modify users.role enum to support all specialized roles
    try {
      await pool.execute("ALTER TABLE users MODIFY COLUMN role ENUM('admin','wali_kelas','wali_murid','guru','staff','pengurus_asrama','tamu','pengasuh','petugas_sarpras','petugas','petugas_umum','petugas_inventaris','petugas_inventaris_umum','petugas_kebersihan','petugas_kebersihan_umum') NOT NULL");
      results.push('✅ Updated users.role ENUM definition to support all new roles');
    } catch (e: any) {
      results.push('❌ Failed to update users.role ENUM: ' + e.message);
    }

    // Repair roles for seeded accounts unconditionally if username or name matches
    try {
      const [fixPengasuh] = await pool.execute("UPDATE users SET role = 'pengasuh', is_pengasuh = 1 WHERE username LIKE 'pengasuh_%' OR nama LIKE 'Pengasuh %'");
      const [fixPengurus] = await pool.execute("UPDATE users SET role = 'pengurus_asrama', is_pengurus_asrama = 1 WHERE username LIKE 'pengurus_%' OR nama LIKE 'Pengurus %'");
      const [fixInventaris] = await pool.execute("UPDATE users SET role = 'petugas_inventaris_umum' WHERE username LIKE '%petugas_inventaris%' OR nama LIKE '%Petugas Inventaris%'");
      const [fixKebersihan] = await pool.execute("UPDATE users SET role = 'petugas_kebersihan_umum' WHERE username LIKE '%petugas_kebersihan%' OR nama LIKE '%Petugas Kebersihan%'");
      const [fixUmum] = await pool.execute("UPDATE users SET role = 'petugas_umum' WHERE username = 'petugas_umum' OR nama = 'Petugas Umum'");
      results.push(`✅ Fixed roles for seeded accounts: ${(fixPengasuh as any).affectedRows} pengasuh, ${(fixPengurus as any).affectedRows} pengurus, ${(fixInventaris as any).affectedRows} petugas inventaris, ${(fixKebersihan as any).affectedRows} petugas kebersihan, ${(fixUmum as any).affectedRows} petugas umum`);
    } catch (e: any) {
      results.push('❌ Failed to repair empty roles: ' + e.message);
    }

    // Repair billing table corrupted asrama records (where billing.asrama was incorrectly assigned or defaulted to Asrama A)
    try {
      const [repairLink] = await pool.execute(`
        UPDATE billing b
        JOIN murid m ON (b.nis IS NOT NULL AND b.nis != '' AND b.nis = m.nis) OR (b.nama_santri IS NOT NULL AND LOWER(TRIM(b.nama_santri)) = LOWER(TRIM(m.nama)))
        JOIN kamar k ON m.kamar_id = k.kamar_id
        SET b.asrama = CASE WHEN k.nama_asrama LIKE 'Asrama %' THEN k.nama_asrama ELSE CONCAT('Asrama ', k.nama_asrama) END,
            b.kamar = k.nama_kamar
        WHERE (b.asrama = 'Asrama A' OR b.asrama = 'Asrama A (-)' OR b.asrama IS NULL OR b.asrama = '')
          AND k.nama_asrama IS NOT NULL AND k.nama_asrama != '' AND k.nama_asrama NOT LIKE '%A%'
      `);

      const [repairPattern] = await pool.execute(`
        UPDATE billing 
        SET asrama = CONCAT('Asrama ', UPPER(SUBSTRING(kamar, 1, 1)))
        WHERE (asrama = 'Asrama A' OR asrama = 'Asrama A (-)' OR asrama IS NULL OR asrama = '')
          AND kamar REGEXP '^[B-Fb-f][0-9\\-]'
      `);

      // Explicit repair for Azqiyatul Imamiyah, Adiba Izdihar & similar unmatched cases
      const [fixAzqiyatul] = await pool.execute(`
        UPDATE billing 
        SET asrama = 'Asrama D', kamar = 'D-5'
        WHERE (nama_santri LIKE '%AZQIYATUL IMAMIYAH%' OR nis = '2026050098')
      `);

      const [fixAdiba] = await pool.execute(`
        UPDATE billing 
        SET asrama = 'Asrama E', kamar = 'E-8'
        WHERE (nama_santri LIKE '%ADIBA IZDIHAR%' OR nis = '2026050118')
      `);

      // Clean up any remaining fake "Asrama A (-)" default fallback records so they don't clog Asrama A
      const [fixUnassigned] = await pool.execute(`
        UPDATE billing 
        SET asrama = '-'
        WHERE asrama = 'Asrama A (-)' AND (kamar = '-' OR kamar IS NULL OR kamar = '' OR kamar = '0')
      `);

      results.push(`✅ Repaired corrupted billing asrama records: ${(repairLink as any).affectedRows} linked, ${(repairPattern as any).affectedRows} pattern fixed, ${(fixAzqiyatul as any).affectedRows + (fixAdiba as any).affectedRows} specific fixed, ${(fixUnassigned as any).affectedRows} fake Asrama A defaults reset`);
    } catch (e: any) {
      results.push('❌ Failed to repair billing asrama: ' + e.message);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
