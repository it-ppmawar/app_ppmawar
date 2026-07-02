import * as XLSX from 'xlsx';

export const downloadTemplate = (type: 'guru' | 'alumni' | 'jadwal_madin' | 'jadwal_quran' | 'jadwal_kegiatan') => {
  let headers: string[] = [];
  let exampleRow: string[] = [];
  let filename = '';

  switch (type) {
    case 'guru':
      headers = ['NIP', 'NAMA LENGKAP', 'JENIS KELAMIN', 'JABATAN', 'NO HP', 'ALAMAT'];
      exampleRow = ['198203042009121002', 'Ahmad Fauzi, M.Pd.', 'L', 'Ustadz Madin', '081234567890', 'Babat, Lamongan'];
      filename = 'Templat_Impor_Guru.xlsx';
      break;
    case 'alumni':
      headers = ['NIS', 'NAMA LENGKAP', 'NIK', 'JENIS KELAMIN', 'NO HP', 'ALAMAT', 'TAHUN MASUK', 'TAHUN KELUAR', 'STATUS KELUAR', 'KATEGORI MUKIM', 'KETERANGAN'];
      exampleRow = ['201901002', 'Lailatul Fitriyah', '3524012345678901', 'P', '085712345678', 'Sukodadi, Lamongan', '2019', '2022', 'Lulus', 'PPM', 'Melanjutkan kuliah'];
      filename = 'Templat_Impor_Alumni.xlsx';
      break;
    case 'jadwal_madin':
      headers = ['HARI', 'JAM MULAI', 'JAM SELESAI', 'KEGIATAN', 'TEMPAT', 'GURU'];
      exampleRow = ['Senin', '14:00', '15:30', 'Fathul Qorib', 'Wustho A', 'Ahmad Fauzi'];
      filename = 'Templat_Impor_Jadwal_Madin.xlsx';
      break;
    case 'jadwal_quran':
      headers = ['HARI', 'JAM MULAI', 'JAM SELESAI', 'KEGIATAN', 'TEMPAT', 'GURU'];
      exampleRow = ['Selasa', '18:30', '20:00', 'Tahfidz Juz 30', 'Kelas 1A', 'Ahmad Fauzi'];
      filename = 'Templat_Impor_Jadwal_Quran.xlsx';
      break;
    case 'jadwal_kegiatan':
      headers = ['HARI', 'JAM MULAI', 'JAM SELESAI', 'KEGIATAN', 'TEMPAT', 'GURU'];
      exampleRow = ['Ahad', '05:00', '06:00', 'Roan Bersama', 'Kamar A1', 'Ahmad Fauzi'];
      filename = 'Templat_Impor_Jadwal_Kegiatan.xlsx';
      break;
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  
  // Auto column widths
  const colWidths = headers.map((h, i) => {
    const valLength = Math.max(h.length, String(exampleRow[i] || '').length);
    return { wch: valLength + 5 };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, filename);
};
