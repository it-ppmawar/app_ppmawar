import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Tabel format_panggilan
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS format_panggilan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        bahasa ENUM('id','ar','en') DEFAULT 'id',
        template TEXT NOT NULL,
        aktif TINYINT(1) DEFAULT 1,
        urutan INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

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
        status ENUM('pending','dibacakan','selesai') DEFAULT 'pending',
        dibacakan_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asrama_status (nama_asrama, status),
        INDEX idx_created (created_at),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Tabel panggilan_devices (monitoring perangkat TOA)
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
        INSERT INTO format_panggilan (nama, bahasa, template, urutan) VALUES
        ('Format Standar', 'id', 'Diumumkan kepada santri atas nama {nama}, harap segera menuju {tujuan}. Sekali lagi, {nama}, harap segera menuju {tujuan}. Terima kasih.', 1),
        ('Format Singkat', 'id', 'Santri {nama} dari kamar {kamar}, harap segera ke {tujuan}.', 2),
        ('Format Resmi', 'id', 'Kepada santri yang terhormat, {nama} dari {kamar}, dimohon dengan hormat untuk segera hadir di {tujuan}. Atas perhatiannya, kami ucapkan terima kasih.', 3),
        ('Format Arab', 'ar', 'يُرجى من الطالب {nama} التوجه فوراً إلى {tujuan}. شكراً لتعاونكم.', 4),
        ('Format Bebas', 'id', '{teks}', 5)
      `);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Tabel panggilan_santri, format_panggilan, dan panggilan_devices berhasil dibuat.',
      tables: ['panggilan_santri', 'format_panggilan', 'panggilan_devices'],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
