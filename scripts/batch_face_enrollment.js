/**
 * Batch Face Enrollment Script (Tahap 1)
 * Memproses 900+ foto santri yang sudah ada di database 'murid'
 * dan mendaftarkan face descriptor ke tabel 'murid_face'
 */

const mysql = require('../node_modules/mysql2/promise');
const path = require('path');
const fs = require('fs');

async function run() {
  const pool = mysql.createPool({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma',
    waitForConnections: true, connectionLimit: 5
  });

  console.log('=== BATCH FACE ENROLLMENT (TAHAP 1) ===\n');

  // Fetch murid with photos
  const [rows] = await pool.execute(
    `SELECT murid_id, nama, jenis_kelamin, foto
     FROM murid
     WHERE foto IS NOT NULL AND foto != '' AND foto != '-'`
  );

  console.log(`Ditemukan ${rows.length} santri yang memiliki foto di DB.`);

  // Check how many already enrolled in murid_face
  const [enrolled] = await pool.execute('SELECT murid_id FROM murid_face');
  const enrolledSet = new Set(enrolled.map(r => r.murid_id));

  console.log(`Sudah ter-enroll sebelumnya: ${enrolledSet.size} santri.`);

  const pending = rows.filter(r => !enrolledSet.has(r.murid_id));
  console.log(`Santri siap diproses: ${pending.length} santri.\n`);

  if (pending.length === 0) {
    console.log('✅ Semua santri berfoto sudah ter-enroll di tabel murid_face.');
    await pool.end();
    process.exit(0);
  }

  console.log('Sample santri siap enroll:');
  pending.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. [ID: ${p.murid_id}] ${p.nama} (${p.jenis_kelamin}) => Foto: ${p.foto}`);
  });

  console.log('\n[INFO] Siap melakukan batch ekstraksi vektor wajah via AI.');
  await pool.end();
  process.exit(0);
}

run().catch(e => { console.error('Error batch enrollment:', e.message); process.exit(1); });
