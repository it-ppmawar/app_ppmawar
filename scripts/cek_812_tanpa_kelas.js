const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');
const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');

async function cek812() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  // 1. Santri tanpa kelas madin
  const [rows] = await conn.execute(`
    SELECT m.murid_id, m.nama, m.nis, m.jenis_kelamin, m.foto, m.created_at,
           kq.nama_kelas as kelas_quran
    FROM murid m
    LEFT JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
    WHERE m.kelas_madin_id IS NULL
    ORDER BY m.jenis_kelamin, m.nama
  `);

  console.log('=== CEK 812 SANTRI TANPA KELAS MADIN ===');
  console.log('Total                 :', rows.length);
  const putra = rows.filter(r => r.jenis_kelamin === 'Laki-laki');
  const putri = rows.filter(r => r.jenis_kelamin === 'Perempuan');
  const unknown = rows.filter(r => !r.jenis_kelamin || (r.jenis_kelamin !== 'Laki-laki' && r.jenis_kelamin !== 'Perempuan'));
  console.log('  - Putra             :', putra.length);
  console.log('  - Putri             :', putri.length);
  console.log('  - Unknown gender    :', unknown.length);

  const denganKelasQuran = rows.filter(r => r.kelas_quran);
  console.log('  - Punya kelas quran :', denganKelasQuran.length);
  console.log('  - Tanpa kelas quran :', rows.length - denganKelasQuran.length);

  // 2. Distribusi angkatan berdasar NIS
  const angkatan = {};
  rows.forEach(r => {
    const tahun = (r.nis && r.nis.length >= 4) ? r.nis.substring(0, 4) : '(no nis)';
    angkatan[tahun] = (angkatan[tahun] || 0) + 1;
  });
  console.log('\nDistribusi angkatan (berdasarkan NIS):');
  Object.entries(angkatan).sort().forEach(([t, n]) => console.log('  -', t, ':', n, 'santri'));

  // 3. Cek apakah ada di jadwal madin
  const jadwalWb = xlsx.readFile('D:/koding/app.ppmawar/data_madin/JADWAL MADIN 2026-2027.xlsx');
  const jadwalNamaMap = {}; // nama → kelas
  jadwalWb.SheetNames.forEach(sName => {
    const sRows = xlsx.utils.sheet_to_json(jadwalWb.Sheets[sName], { header: 1 });
    sRows.forEach(row => {
      if (!row || row.length < 2) return;
      const namaCell = row.find(cell => typeof cell === 'string' && cell.trim().length > 4 && isNaN(cell.trim()));
      if (namaCell && !namaCell.toLowerCase().includes('nama')) {
        jadwalNamaMap[namaCell.trim().toUpperCase()] = sName;
      }
    });
  });

  let adaDiJadwal = 0;
  const matchedInJadwal = [];
  rows.forEach(r => {
    const normNama = r.nama.trim().toUpperCase();
    if (jadwalNamaMap[normNama]) {
      adaDiJadwal++;
      matchedInJadwal.push({ ...r, kelas_jadwal: jadwalNamaMap[normNama] });
    }
  });
  console.log('\nSantri tanpa kelas madin tapi ADA di jadwal madin:', adaDiJadwal);
  if (matchedInJadwal.length > 0) {
    console.log('  Contoh:');
    matchedInJadwal.slice(0, 5).forEach(r => console.log('   -', r.nama, '→', r.kelas_jadwal));
  }

  // 4. Export ke Excel
  const wb = xlsx.utils.book_new();

  // Sheet 1: semua santri tanpa kelas
  const allData = rows.map((r, i) => ({
    'No': i + 1,
    'Nama': r.nama,
    'NIS': r.nis || '-',
    'Gender': r.jenis_kelamin || '?',
    'Kelas Quran': r.kelas_quran || '-',
    'Ada di Jadwal 2026': matchedInJadwal.find(m => m.murid_id === r.murid_id)?.kelas_jadwal || '-',
    'Foto': r.foto ? 'Ada' : 'Tidak',
    'Tgl Input': r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-',
  }));
  const ws1 = xlsx.utils.json_to_sheet(allData);
  xlsx.utils.book_append_sheet(wb, ws1, 'Semua Tanpa Kelas Madin');

  // Sheet 2: yang ada di jadwal (bisa langsung kita assign)
  if (matchedInJadwal.length > 0) {
    const matchedData = matchedInJadwal.map((r, i) => ({
      'No': i + 1,
      'Nama': r.nama,
      'NIS': r.nis || '-',
      'Gender': r.jenis_kelamin || '?',
      'Kelas Jadwal 2026-2027': r.kelas_jadwal,
      'Kelas Quran': r.kelas_quran || '-',
    }));
    const ws2 = xlsx.utils.json_to_sheet(matchedData);
    xlsx.utils.book_append_sheet(wb, ws2, 'Bisa Langsung Dipetakan');
  }

  xlsx.writeFile(wb, 'D:/koding/app.ppmawar/data_madin/SANTRI_TANPA_KELAS_MADIN_AUDIT.xlsx');
  console.log('\n✅ File SANTRI_TANPA_KELAS_MADIN_AUDIT.xlsx berhasil dibuat!');

  await conn.end();
}

cek812().catch(e => console.error('Error:', e.message));
