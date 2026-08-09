const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');

async function eksekusi() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  console.log('=== EKSEKUSI UPDATE & INSERT 16 SANTRI ===\n');

  // ─── STEP 1: UPDATE KELAS 7 santri yang sudah ada di DB ─────────────────
  const updates = [
    { nis: '2024070669', nama: 'KHANSA NABIIHAH SAKHIH',   kelas_id: 16, kelas: '1 WUSTHO A PUTRI' },
    { nis: '2025070185', nama: 'RYAN ARDIANSYAH',           kelas_id: 3,  kelas: '2 WUSTHO A PUTRA' },
    { nis: '2024070623', nama: 'NAURAH KUNIATUN',            kelas_id: 38, kelas: '3 ULA B PUTRI' },
    { nis: '2024070631', nama: "ATHIIYAH AULIA'UL",         kelas_id: 32, kelas: '3 ULA C PUTRI' },
    { nis: '2024070043', nama: 'FARIKHTA RAMADHANI',        kelas_id: 21, kelas: '3 WUSTHO A PUTRI' },
    { nis: '2025070470', nama: 'SYAIDATUN MAULIDYA',        kelas_id: 27, kelas: '2 ULA A PUTRI' },
    { nis: '2025070210', nama: 'ZAIMAH LULUK',              kelas_id: 22, kelas: '2 WUSTHO B PUTRI' },
  ];

  console.log('--- UPDATE KELAS 7 SANTRI ---');
  for (const u of updates) {
    const [rows] = await conn.execute(
      'SELECT murid_id, nama, (SELECT nama_kelas FROM kelas_madin WHERE kelas_id = murid.kelas_madin_id) as kelas_lama FROM murid WHERE nis = ?',
      [u.nis]
    );
    if (rows.length === 0) { console.log(`  ❌ NIS ${u.nis} tidak ditemukan`); continue; }
    const r = rows[0];
    if (r.kelas_madin_id === u.kelas_id) {
      console.log(`  ✅ ${r.nama} → sudah di kelas ${u.kelas}`);
      continue;
    }
    await conn.execute('UPDATE murid SET kelas_madin_id = ?, updated_at = NOW() WHERE nis = ?', [u.kelas_id, u.nis]);
    console.log(`  🔄 ${r.nama} → ${r.kelas_lama || 'NULL'} → ${u.kelas} ✅`);
  }

  // ─── STEP 2: INSERT 2 santri baru yang punya NIS tapi belum ada di DB ───
  const inserts = [
    { nis: '2026060161', nama: 'SHELSYA KANNAH CYBIELLAH', gender: 'Perempuan', kelas_id: 19, kelas: '1 WUSTHO C PUTRI' },
    { nis: '2026060162', nama: 'TSANIYAH NAILATUL IZZA',   gender: 'Perempuan', kelas_id: 19, kelas: '1 WUSTHO C PUTRI' },
  ];

  console.log('\n--- INSERT 2 SANTRI BARU ---');
  for (const ins of inserts) {
    // Cek dulu jangan sampai sudah ada
    const [existing] = await conn.execute('SELECT murid_id FROM murid WHERE nis = ?', [ins.nis]);
    if (existing.length > 0) {
      console.log(`  ⚠️  NIS ${ins.nis} (${ins.nama}) sudah ada, skip`);
      continue;
    }
    const [result] = await conn.execute(
      `INSERT INTO murid (nama, nis, jenis_kelamin, kelas_madin_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [ins.nama, ins.nis, ins.gender, ins.kelas_id]
    );
    console.log(`  ✅ INSERT ${ins.nama} | NIS: ${ins.nis} | ${ins.kelas} | murid_id: ${result.insertId}`);
  }

  // ─── STEP 3: Verifikasi akhir ─────────────────────────────────────────────
  console.log('\n--- VERIFIKASI AKHIR ---');
  const semuaNis = [...updates.map(u => u.nis), ...inserts.map(i => i.nis)];
  const [verif] = await conn.execute(
    `SELECT m.nama, m.nis, km.nama_kelas FROM murid m 
     LEFT JOIN kelas_madin km ON m.kelas_madin_id = km.kelas_id 
     WHERE m.nis IN (${semuaNis.map(() => '?').join(',')})
     ORDER BY m.nis`,
    semuaNis
  );
  verif.forEach(r => console.log(`  ✅ ${r.nis} - ${r.nama} → ${r.nama_kelas || 'NULL'}`));

  console.log('\n=== SELESAI! ===');
  console.log('Yang masih perlu konfirmasi NIS dari rekan tim (6 santri):');
  const tanpaNis = [
    'M. DZAKY ABIYASA (3 ULA A PUTRA)',
    'ANIS NUR FAIZAH (1 WUSTHO C PUTRI)',
    'RATU AYU TIRTI NEGORO (2 ULA A PUTRI)',
    'RESA FIDIATUN NISA (2 ULA A PUTRI)',
    'TRYAS NABILA ARSYOY (2 ULA B PUTRI)',
    'RANA RAILIHATUL (2 ULA C PUTRI)',
  ];
  tanpaNis.forEach((n, i) => console.log(`  ${i+1}. ${n}`));

  await conn.end();
}

eksekusi().catch(e => console.error('Error:', e.message));
