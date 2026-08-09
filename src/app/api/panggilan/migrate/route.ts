import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Tabel format_panggilan (dengan kolom jenis_suara untuk Pria/Wanita)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS format_panggilan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(150) NOT NULL,
        bahasa ENUM('id','ar','en','jv') DEFAULT 'id',
        jenis_suara ENUM('pria','wanita','auto') DEFAULT 'auto',
        template TEXT NOT NULL,
        aktif TINYINT(1) DEFAULT 1,
        urutan INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Tambah kolom jenis_suara jika belum ada (untuk database yang sudah ada)
    try {
      await pool.execute(`ALTER TABLE format_panggilan ADD COLUMN jenis_suara ENUM('pria','wanita','auto') DEFAULT 'auto' AFTER bahasa`);
    } catch (_) { /* Kolom sudah ada, lanjut */ }

    // Tambah kolom bahasa 'jv' jika belum ada
    try {
      await pool.execute(`ALTER TABLE format_panggilan MODIFY COLUMN bahasa ENUM('id','ar','en','jv') DEFAULT 'id'`);
    } catch (_) { /* Kolom sudah ada, lanjut */ }

    // Tabel panggilan_santri
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS panggilan_santri (
        id INT AUTO_INCREMENT PRIMARY KEY,
        santri_id INT NOT NULL,
        santri_nama VARCHAR(255) NOT NULL,
        santri_nama_panggilan VARCHAR(255),
        kamar_id INT,
        nama_kamar VARCHAR(100),
        nama_asrama VARCHAR(100),
        dipanggil_oleh INT NOT NULL,
        peran_pemanggil VARCHAR(50),
        nama_pemanggil VARCHAR(255),
        format_id INT,
        teks_panggilan TEXT NOT NULL,
        tujuan VARCHAR(255),
        pengulangan TINYINT(1) DEFAULT 1,
        bahasa VARCHAR(5) DEFAULT 'id',
        jenis_suara ENUM('pria','wanita','auto') DEFAULT 'auto',
        status ENUM('pending','dibacakan','selesai') DEFAULT 'pending',
        dibacakan_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asrama_status (nama_asrama, status),
        INDEX idx_created (created_at),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Tambah kolom bahasa & jenis_suara di panggilan_santri jika belum ada
    try {
      await pool.execute(`ALTER TABLE panggilan_santri ADD COLUMN bahasa VARCHAR(5) DEFAULT 'id' AFTER pengulangan`);
    } catch (_) {}
    try {
      await pool.execute(`ALTER TABLE panggilan_santri ADD COLUMN jenis_suara ENUM('pria','wanita','auto') DEFAULT 'auto' AFTER bahasa`);
    } catch (_) {}

    // Tabel panggilan_devices
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

    // Insert default format jika belum ada
    const [existing]: any = await pool.execute('SELECT COUNT(*) as cnt FROM format_panggilan');
    if (existing[0].cnt === 0) {
      await pool.execute(`
        INSERT INTO format_panggilan (nama, bahasa, jenis_suara, template, urutan) VALUES

        -- ──────────── BAHASA INDONESIA BAKU ────────────
        ('Indonesia Baku – Pria', 'id', 'pria',
        'Assalamualaikum warahmatullahi wabarakatuh. Diberitahukan kepada seluruh santri, bahwa santri atas nama {nama} dari kamar {kamar}, dimohon untuk segera menuju {tujuan}. Sekali lagi, santri {nama}, harap segera menuju {tujuan}. Terima kasih.',
        10),

        ('Indonesia Baku – Wanita', 'id', 'wanita',
        'Assalamualaikum warahmatullahi wabarakatuh. Diberitahukan kepada seluruh santri, bahwa santri atas nama {nama} dari kamar {kamar}, dimohon untuk segera menuju {tujuan}. Sekali lagi, santri {nama}, harap segera menuju {tujuan}. Terima kasih.',
        11),

        ('Indonesia Singkat', 'id', 'auto',
        'Santri {nama} dari kamar {kamar}, harap segera menuju {tujuan}.',
        12),

        -- ──────────── BAHASA ARAB FASIH ────────────
        ('Arab Fasih – Pria', 'ar', 'pria',
        'السلام عليكم ورحمة الله وبركاته. يُرجى من الطالب الكريم {nama} من غرفة {kamar}، التوجه فوراً إلى {tujuan}. نكرر، الطالب {nama}، يُرجى الحضور فوراً إلى {tujuan}. شكراً لتعاونكم، والسلام عليكم.',
        20),

        ('Arab Fasih – Wanita', 'ar', 'wanita',
        'السلام عليكم ورحمة الله وبركاته. يُرجى من الطالبة الكريمة {nama} من غرفة {kamar}، التوجه فوراً إلى {tujuan}. نكرر، الطالبة {nama}، يُرجى الحضور فوراً إلى {tujuan}. شكراً لتعاونكم، والسلام عليكم.',
        21),

        ('Arab Singkat', 'ar', 'auto',
        'الطالب {nama} من غرفة {kamar}، يُرجى التوجه إلى {tujuan} فوراً.',
        22),

        -- ──────────── BAHASA JAWA HALUS ────────────
        ('Jawa Halus – Pria', 'jv', 'pria',
        'Assalamualaikum warahmatullahi wabarakatuh. Dhumateng para santri sedaya, dipunwartosaken bilih santri asmanipun {nama} saking kamar {kamar}, kasuwun enggal rawuh dhateng {tujuan}. Matur nuwun.',
        30),

        ('Jawa Halus – Wanita', 'jv', 'wanita',
        'Assalamualaikum warahmatullahi wabarakatuh. Dhumateng para santri sedaya, dipunwartosaken bilih santri asmanipun {nama} saking kamar {kamar}, kasuwun enggal rawuh dhateng {tujuan}. Matur nuwun.',
        31),

        -- ──────────── BAHASA INGGRIS NATIVE ────────────
        ('English Native – Male', 'en', 'pria',
        'Assalamualaikum. Attention please. This is an announcement for student {nama} from room {kamar}. You are kindly requested to proceed immediately to {tujuan}. Once again, {nama}, please report to {tujuan} at once. Thank you.',
        40),

        ('English Native – Female', 'en', 'wanita',
        'Assalamualaikum. Attention please. This is an announcement for student {nama} from room {kamar}. You are kindly requested to proceed immediately to {tujuan}. Once again, {nama}, please report to {tujuan} at once. Thank you.',
        41),

        -- ──────────── FORMAT BEBAS ────────────
        ('Format Bebas', 'id', 'auto', '{teks}', 99)
      `);
    }

    return NextResponse.json({
      success: true,
      message: 'Tabel panggilan_santri, format_panggilan, dan panggilan_devices berhasil dibuat/diperbarui.',
      tables: ['panggilan_santri', 'format_panggilan', 'panggilan_devices'],
      default_formats: 11,
      languages: ['Indonesia Baku', 'Arab Fasih', 'Jawa Halus', 'Inggris Native'],
      voice_options: ['Pria', 'Wanita', 'Auto'],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
