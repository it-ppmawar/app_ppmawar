const xlsx = require('D:/koding/app.ppmawar/node_modules/xlsx');
const path = require('path');

function createAuditExcel() {
  const wb = xlsx.utils.book_new();

  // Sheet 1: 8 Santri Ditemukan di DB (Match / Typo)
  const dataDb = [
    { No: 1, 'Nama di Excel': 'MARCEL AULIA', 'Kelas Madin Excel': '2 WUSTHO A PUTRA', 'Nama Lengkap di DB': 'M. MARCEL AULIA WICAKSANA', NIS: '2025070280', Status: 'SUDAH ADA DI DB ✅' },
    { No: 2, 'Nama di Excel': 'NAILATUR NUR LAILATUL', 'Kelas Madin Excel': '3 ULA A PUTRI', 'Nama Lengkap di DB': 'NAILATUN NUR LAILATUL QUDSIYAH', NIS: '2024070726', Status: 'SUDAH ADA DI DB ✅' },
    { No: 3, 'Nama di Excel': 'NATASYA ENGELINA AMANDA', 'Kelas Madin Excel': '3 ULA C PUTRI', 'Nama Lengkap di DB': 'NATASYA ANGELINA AMANDA FERDIANA', NIS: '2024070523', Status: 'SUDAH ADA DI DB ✅' },
    { No: 4, 'Nama di Excel': 'BALQIS NAISILLA SABILAH', 'Kelas Madin Excel': '3 WUSTHO A PUTRI', 'Nama Lengkap di DB': 'BALQIS NAYSILLA SABILAH', NIS: '2024070152', Status: 'SUDAH ADA DI DB ✅ (Beda Ejaan)' },
    { No: 5, 'Nama di Excel': 'AULIA AFIQOH MAR SAID', 'Kelas Madin Excel': '2 ULA A PUTRI', 'Nama Lengkap di DB': 'SHOFIE AULIA AFIQAH MARSAID', NIS: '2025070593', Status: 'SUDAH ADA DI DB ✅' },
    { No: 6, 'Nama di Excel': 'DAFINAH ALISA BATRISYA', 'Kelas Madin Excel': '2 ULA A PUTRI', 'Nama Lengkap di DB': 'DAFINAH ALISHA BATRISYA HARIANTO', NIS: '2025070514', Status: 'SUDAH ADA DI DB ✅ (Beda Ejaan)' },
    { No: 7, 'Nama di Excel': 'ANNISA RETNO LULUK NUR', 'Kelas Madin Excel': '2 ULA C PUTRI', 'Nama Lengkap di DB': 'ANISA RETNO LULUK NUR MANGGALI', NIS: '2025070598', Status: 'SUDAH ADA DI DB ✅' },
    { No: 8, 'Nama di Excel': 'AURA HANA ZILFAH', 'Kelas Madin Excel': '2 WUSTHO A PUTRI', 'Nama Lengkap di DB': 'AURA HANNA ZILFAH DLOFWATUL `AISY', NIS: '2025070411', Status: 'SUDAH ADA DI DB ✅' }
  ];
  const wsDb = xlsx.utils.json_to_sheet(dataDb);
  xlsx.utils.book_append_sheet(wb, wsDb, '8 Santri Sudah Ada di DB');

  // Sheet 2: 16 Santri Murni Belum Ada di DB
  const dataUnmatched = [
    { No: 1, 'Nama Santri': 'M. DZAKY ABIYASA', 'Kelas Madin Target': '3 ULA A PUTRA', Gender: 'Laki-laki', Action: 'Perlu Di-input ke DB' },
    { No: 2, 'Nama Santri': 'KHANSA NABIIHAH SAKHIH', 'Kelas Madin Target': '1 WUSTHO A PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 3, 'Nama Santri': 'RYAN ARDIANSYAH', 'Kelas Madin Target': '2 WUSTHO A PUTRA', Gender: 'Laki-laki', Action: 'Perlu Di-input ke DB' },
    { No: 4, 'Nama Santri': 'ANIS NUR FAIZAH', 'Kelas Madin Target': '1 WUSTHO C PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 5, 'Nama Santri': 'NAURAH KUNIATUN', 'Kelas Madin Target': '3 ULA B PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 6, 'Nama Santri': 'ATHIIYAH AULIA\'UL', 'Kelas Madin Target': '3 ULA C PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 7, 'Nama Santri': 'SHEISYA KANNAH CYBIELLAH', 'Kelas Madin Target': '1 WUSTHO C PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 8, 'Nama Santri': 'TSANIYAH NAILATUL IZZA', 'Kelas Madin Target': '1 WUSTHO C PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 9, 'Nama Santri': 'FARIHTA RAMADHANI', 'Kelas Madin Target': '3 WUSTHO A PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 10, 'Nama Santri': 'SYAIDATUN MAULIDYA', 'Kelas Madin Target': '2 ULA A PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 11, 'Nama Santri': 'RATU AYU TIRTI NEGORO', 'Kelas Madin Target': '2 ULA A PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 12, 'Nama Santri': 'RESA FIDIATUN NISA', 'Kelas Madin Target': '2 ULA A PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 13, 'Nama Santri': 'SABRINA ZAHRA NURIS SYA\'BANI', 'Kelas Madin Target': '2 ULA B PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 14, 'Nama Santri': 'TRYAS NABILA ARSYOY', 'Kelas Madin Target': '2 ULA B PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 15, 'Nama Santri': 'RANA RAILIHATUL', 'Kelas Madin Target': '2 ULA C PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' },
    { No: 16, 'Nama Santri': 'ZAIMAH LULUK', 'Kelas Madin Target': '2 WUSTHO B PUTRI', Gender: 'Perempuan', Action: 'Perlu Di-input ke DB' }
  ];
  const wsUnmatched = xlsx.utils.json_to_sheet(dataUnmatched);
  xlsx.utils.book_append_sheet(wb, wsUnmatched, '16 Santri Murni Belum Ada');

  // Sheet 3: Baris Sampah
  const dataGarbage = [
    { No: 1, 'Teks di Excel': 'U22', Keterangan: 'Bukan santri (Artefak potongan sel Excel U22.26661 Wustho C Putri)' }
  ];
  const wsGarbage = xlsx.utils.json_to_sheet(dataGarbage);
  xlsx.utils.book_append_sheet(wb, wsGarbage, '1 Teks Sampah Excel');

  const outputPath = 'D:/koding/app.ppmawar/data_madin/HASIL_AUDIT_25_SANTRI_BELUM_ADA_DB.xlsx';
  xlsx.writeFile(wb, outputPath);
  console.log('✅ File audit Excel berhasil dibuat di:', outputPath);
}

createAuditExcel();
