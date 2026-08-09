const mysql = require('D:/koding/app.ppmawar/node_modules/mysql2/promise');

// Data dari rekan tim - 16 santri dengan NIS sebagian sudah diisi
// __EMPTY_1 = NIS yang diberikan rekan tim
const santri16 = [
  { nama: 'M. DZAKY ABIYASA',         kelas: '3 ULA A PUTRA',      gender: 'Laki-laki',   nis: null,         note: '' },
  { nama: 'KHANSA NABIIHAH SAKHIH',   kelas: '1 WUSTHO A PUTRI',   gender: 'Perempuan',   nis: '2024070669', note: '' },
  { nama: 'RYAN ARDIANSYAH',          kelas: '2 WUSTHO A PUTRA',   gender: 'Laki-laki',   nis: '2025070185', note: '' },
  { nama: 'ANIS NUR FAIZAH',          kelas: '1 WUSTHO C PUTRI',   gender: 'Perempuan',   nis: null,         note: '' },
  { nama: 'NAURAH KUNIATUN',          kelas: '3 ULA B PUTRI',       gender: 'Perempuan',   nis: '2024070623', note: '' },
  { nama: "ATHIIYAH AULIA'UL",        kelas: '3 ULA C PUTRI',      gender: 'Perempuan',   nis: '2024070631', note: '' },
  { nama: 'SHELSYA KANNAH CYBIELLAH', kelas: '1 WUSTHO C PUTRI',   gender: 'Perempuan',   nis: '2026060161', note: '' },
  { nama: 'TSANIYAH NAILATUL IZZA',   kelas: '1 WUSTHO C PUTRI',   gender: 'Perempuan',   nis: '2026060162', note: '' },
  { nama: 'FARIKHTA RAMADHANI',       kelas: '3 WUSTHO A PUTRI',   gender: 'Perempuan',   nis: '2024070043', note: '' },
  { nama: 'SYAIDATUN MAULIDYA',       kelas: '2 ULA A PUTRI',      gender: 'Perempuan',   nis: '2025070470', note: '' },
  { nama: 'RATU AYU TIRTI NEGORO',    kelas: '2 ULA A PUTRI',      gender: 'Perempuan',   nis: null,         note: '' },
  { nama: 'RESA FIDIATUN NISA',       kelas: '2 ULA A PUTRI',      gender: 'Perempuan',   nis: null,         note: '' },
  { nama: "SABRINA ZAHRA NURIS SYA'BANI", kelas: '2 ULA B PUTRI', gender: 'Perempuan',   nis: null,         note: 'BOYONG' },
  { nama: 'TRYAS NABILA ARSYOY',      kelas: '2 ULA B PUTRI',      gender: 'Perempuan',   nis: null,         note: '' },
  { nama: 'RANA RAILIHATUL',          kelas: '2 ULA C PUTRI',      gender: 'Perempuan',   nis: null,         note: '' },
  { nama: 'ZAIMAH LULUK',             kelas: '2 WUSTHO B PUTRI',   gender: 'Perempuan',   nis: '2025070210', note: '' },
];

// Mapping nama kelas → kelas_id
const kelasMap = {
  '3 ULA A PUTRA':    34,
  '1 WUSTHO A PUTRI': 16,
  '2 WUSTHO A PUTRA': 3,
  '1 WUSTHO C PUTRI': 19,
  '3 ULA B PUTRI':    38,
  '3 ULA C PUTRI':    32,
  '3 WUSTHO A PUTRI': 21,
  '2 ULA A PUTRI':    27,
  '2 ULA B PUTRI':    28,
  '2 ULA C PUTRI':    29,
  '2 WUSTHO B PUTRI': 22,
};

async function cekDanSiapkan() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'ppmawaro_absensi_ppma'
  });

  console.log('=== ANALISIS 16 SANTRI DARI REKAN TIM ===\n');

  const hasilNis    = [];  // sudah ada NIS → cek di DB
  const tanpaNis    = [];  // belum ada NIS → perlu input manual
  const boyong      = [];  // status boyong → skip
  const sudahAdaDiDb = []; // ternyata sudah ada di DB dengan NIS tsb
  const benarBelumAda = []; // benar-benar belum ada

  for (const s of santri16) {
    if (s.note === 'BOYONG') {
      boyong.push(s);
      continue;
    }

    if (s.nis) {
      // Cek apakah NIS ini sudah ada di DB
      const [rows] = await conn.execute(
        'SELECT murid_id, nama, nis, kelas_madin_id, (SELECT nama_kelas FROM kelas_madin WHERE kelas_id = murid.kelas_madin_id) as kelas_lama FROM murid WHERE nis = ?',
        [String(s.nis)]
      );

      if (rows.length > 0) {
        const r = rows[0];
        sudahAdaDiDb.push({ ...s, db_nama: r.nama, db_murid_id: r.murid_id, db_kelas: r.kelas_lama });
        console.log(`🔍 [NIS ${s.nis}] ADA di DB: ${r.nama} (kelas: ${r.kelas_lama || 'NULL'})`);
        console.log(`   → Target kelas: ${s.kelas}`);
      } else {
        benarBelumAda.push(s);
        console.log(`❌ [NIS ${s.nis}] BELUM ADA di DB: ${s.nama} → perlu INSERT ke kelas ${s.kelas}`);
      }
    } else {
      tanpaNis.push(s);
      console.log(`⚠️  [TANPA NIS] ${s.nama} → kelas ${s.kelas} (NIS perlu dicari/dibuat)`);
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log('Yang ternyata SUDAH ADA di DB (punya NIS valid)  :', sudahAdaDiDb.length);
  console.log('Yang BENAR-BENAR belum ada (punya NIS, DB kosong) :', benarBelumAda.length);
  console.log('Yang BELUM ADA NIS sama sekali                    :', tanpaNis.length);
  console.log('Yang status BOYONG (skip)                         :', boyong.length);

  if (sudahAdaDiDb.length > 0) {
    console.log('\n=== YANG SUDAH ADA DI DB (perlu update kelas saja) ===');
    sudahAdaDiDb.forEach(s => {
      const kelasId = kelasMap[s.kelas];
      console.log(`  UPDATE murid SET kelas_madin_id=${kelasId} WHERE nis='${s.nis}'; -- ${s.nama} → ${s.kelas}`);
    });
  }

  if (benarBelumAda.length > 0) {
    console.log('\n=== YANG PERLU DI-INSERT (punya NIS tapi belum ada) ===');
    benarBelumAda.forEach(s => {
      const kelasId = kelasMap[s.kelas];
      console.log(`  INSERT: ${s.nama} | NIS: ${s.nis} | ${s.gender} | kelas_id: ${kelasId}`);
    });
  }

  if (tanpaNis.length > 0) {
    console.log('\n=== YANG BELUM PUNYA NIS (perlu konfirmasi lebih lanjut) ===');
    tanpaNis.forEach(s => {
      console.log(`  - ${s.nama} | ${s.kelas} | ${s.gender}`);
    });
  }

  await conn.end();
}

cekDanSiapkan().catch(e => console.error('Error:', e.message));
