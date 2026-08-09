const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');
const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');

async function generateAccurateAudit() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  console.log('=== AUDIT PRESISI DENGAN KATEGORISASI SANTRI MUKIM VS LPPM ===\n');

  // Ambil semua santri tanpa kelas madin
  const [rows] = await conn.execute(`
    SELECT 
      m.murid_id, m.nama, m.nis, m.jenis_kelamin, m.foto, m.created_at,
      m.kamar_id, k.nama_kamar, k.nama_asrama
    FROM murid m
    LEFT JOIN kamar k ON m.kamar_id = k.kamar_id
    WHERE m.kelas_madin_id IS NULL
    ORDER BY (m.kamar_id IS NULL), k.nama_asrama, m.nama
  `);

  console.log('Total santri tanpa kelas madin:', rows.length);

  const santriMukimTanpaMadin = rows.filter(r => r.kamar_id !== null);
  const santriLppmNonMukim = rows.filter(r => r.kamar_id === null);

  console.log('  1. Santri MUKIM (Punya Kamar Asrama tapi Belum Ada Kelas Madin):', santriMukimTanpaMadin.length);
  console.log('  2. Santri LPPM / NON-MUKIM (Tanpa Kamar Asrama & Tanpa Madin)   :', santriLppmNonMukim.length);

  // Detail 16 Santri Mukim Tanpa Madin
  console.log('\n--- DETAIL 16 SANTRI MUKIM YANG BELUM PUNYA KELAS MADIN ---');
  santriMukimTanpaMadin.forEach((r, i) => {
    console.log(`${i+1}. [NIS ${r.nis || '-'}] ${r.nama} (${r.jenis_kelamin}) - ${r.nama_asrama} / ${r.nama_kamar}`);
  });

  // Buat workbook Excel yang terstruktur dan sangat rapi
  const wb = xlsx.utils.book_new();

  // Sheet 1: Ringkasan & Kategori Utama
  const summarySheetData = [
    { 'Kategori': '1. Santri Mukim (Pondok) Belum Ada Kelas Madin', 'Jumlah Santri': santriMukimTanpaMadin.length, 'Keterangan': 'Punya Kamar Asrama, Wajib di-assign Kelas Madin!' },
    { 'Kategori': '2. Santri LPPM / Non-Mukim (Luar Pondok)', 'Jumlah Santri': santriLppmNonMukim.length, 'Keterangan': 'Tidak Bermukim / Hanya Sekolah Formal (LPPM)' },
    { 'Kategori': 'TOTAL SANTRI TANPA KELAS MADIN', 'Jumlah Santri': rows.length, 'Keterangan': '' }
  ];
  const wsSummary = xlsx.utils.json_to_sheet(summarySheetData);
  xlsx.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Kategori');

  // Sheet 2: Santri Mukim Belum Ada Kelas Madin (PERLU DITINDAKLANJUTI SEGERA)
  const mukimData = santriMukimTanpaMadin.map((r, i) => ({
    'No': i + 1,
    'Nama Santri': r.nama,
    'NIS': r.nis || '-',
    'Jenis Kelamin': r.jenis_kelamin || '-',
    'Asrama': r.nama_asrama,
    'Kamar': r.nama_kamar,
    'Status': 'MUKIM (Pondok)',
    'Catatan / Rekomendasi': 'Segera Tentukan Kelas Madin'
  }));
  const wsMukim = xlsx.utils.json_to_sheet(mukimData);
  xlsx.utils.book_append_sheet(wb, wsMukim, 'Mukim Belum Ada Madin');

  // Sheet 3: Santri LPPM / Non-Mukim (Luar Pondok)
  const lppmData = santriLppmNonMukim.map((r, i) => ({
    'No': i + 1,
    'Nama Santri': r.nama,
    'NIS': r.nis || '-',
    'Jenis Kelamin': r.jenis_kelamin || '-',
    'Status Asrama': 'Non-Mukim / LPPM (Tanpa Kamar)',
    'Status Madin': 'Kosong (LPPM)',
    'Tgl Input Data': r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-'
  }));
  const wsLppm = xlsx.utils.json_to_sheet(lppmData);
  xlsx.utils.book_append_sheet(wb, wsLppm, 'Santri LPPM (Non-Mukim)');

  const filePath = 'D:/koding/app.ppmawar/data_madin/SANTRI_TANPA_KELAS_MADIN_AUDIT_PRESISI.xlsx';
  xlsx.writeFile(wb, filePath);
  console.log(`\n✅ File Excel Audit Presisi Berhasil Dibuat: ${filePath}`);

  await conn.end();
}

generateAccurateAudit().catch(e => console.error(e));
