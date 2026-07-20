import * as XLSX from 'xlsx';

export const downloadTemplate = (type: 'guru' | 'alumni' | 'jadwal_madin' | 'jadwal_quran' | 'jadwal_kegiatan' | 'jurnal_madin' | 'jurnal_quran' | 'jurnal_kamar' | 'jadwal_alumni' | 'ketertiban' | 'kelas' | 'kamar' | 'users' | 'kurikulum' | 'inventaris' | 'kebersihan') => {
  let headers: string[] = [];
  let exampleRow: string[] = [];
  let filename = '';

  switch (type) {
    case 'guru':
      headers = ['NIP', 'NAMA LENGKAP', 'JENIS KELAMIN', 'JABATAN', 'NO HP', 'ALAMAT'];
      exampleRow = ['198203042009121002', 'Ahmad Fauzi, M.Pd.', 'L', 'Ustadz Madin', '081234567890', 'Babat, Lamongan'];
      filename = 'Templat_Impor_Guru.xlsx';
      break;
    case 'kurikulum':
      headers = ['TINGKATAN', 'MATA PELAJARAN', 'JENJANG KITAB', 'KETERANGAN'];
      exampleRow = ['ULA', 'Fiqh', 'Safinatun Najah', 'Kitab fiqih dasar'];
      filename = 'Templat_Impor_Kurikulum.xlsx';
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
    case 'jurnal_madin':
      headers = ['TANGGAL (YYYY-MM-DD)', 'KELAS MADIN', 'MATERI', 'CATATAN', 'KENDALA'];
      exampleRow = ['2026-07-03', 'Ula A', 'Bab Thoharoh', 'Murid antusias', 'Sebagian terlambat'];
      filename = 'Templat_Impor_Jurnal_Madin.xlsx';
      break;
    case 'jurnal_quran':
      headers = ['TANGGAL (YYYY-MM-DD)', 'KELAS QURAN', 'MATERI', 'CATATAN', 'KENDALA'];
      exampleRow = ['2026-07-03', 'Juz 30 A', 'Murojaah Annaba', 'Lancar', 'Terdapat beberapa dengungan kurang tepat'];
      filename = 'Templat_Impor_Jurnal_Quran.xlsx';
      break;
    case 'jurnal_kamar':
      headers = ['TANGGAL (YYYY-MM-DD)', 'KAMAR', 'MATERI', 'CATATAN', 'KENDALA'];
      exampleRow = ['2026-07-03', 'A1', 'Kajian Kitab Al-Hikam', 'Selesai bab 1', 'Suara kurang keras'];
      filename = 'Templat_Impor_Jurnal_Kamar.xlsx';
      break;
    case 'jadwal_alumni':
      headers = ['JAM MULAI', 'JAM SELESAI', 'KEGIATAN', 'TEMPAT', 'KETERANGAN'];
      exampleRow = ['08:00', '10:00', 'Khotmil Quran', 'Masjid Utama', 'Sifatnya wajib'];
      filename = 'Templat_Impor_Jadwal_Alumni.xlsx';
      break;
    case 'ketertiban':
      headers = ['NIS', 'NAMA SANTRI', 'JENIS KELAMIN', 'TANGGAL (YYYY-MM-DD)', 'JENIS PELANGGARAN', 'DESKRIPSI'];
      exampleRow = ['202301004', 'Muhammad Zidan', 'Laki-laki', '2026-07-03', 'Keterlambatan', 'Terlambat berjamaah subuh'];
      filename = 'Templat_Impor_Ketertiban.xlsx';
      break;
    case 'kelas':
      headers = ['NAMA KELAS', 'TIPE (madin/quran)', 'WALI KELAS (NIP/NAMA)'];
      exampleRow = ['1A Wustho', 'madin', '198203042009121002'];
      filename = 'Templat_Impor_Kelas.xlsx';
      break;
    case 'kamar':
      headers = ['NAMA KAMAR', 'PEMBINA (NIP/NAMA)'];
      exampleRow = ['G1', '198203042009121002'];
      filename = 'Templat_Impor_Kamar.xlsx';
      break;
    case 'users':
      headers = ['USERNAME', 'NAMA', 'ROLE (admin/staff/guru/pengurus_asrama/wali_murid)', 'PASSWORD', 'NIP / NIS'];
      exampleRow = ['zidan123', 'Muhammad Zidan', 'wali_murid', 'Mawar123', '202301004'];
      filename = 'Templat_Impor_Users.xlsx';
      break;
    case 'inventaris':
      headers = ['NAMA BARANG', 'KATEGORI (alat/sarana/prasarana/lainnya)', 'ASRAMA (Asrama A/B/C/D/E/F/Tahfid)', 'JUMLAH', 'KONDISI (Baik/Rusak Ringan/Rusak Berat)', 'KETERANGAN'];
      exampleRow = ['Sapu Ijuk', 'alat', 'Asrama A', '5', 'Baik', 'Sapu ijuk kualitas bagus'];
      filename = 'Templat_Impor_Inventaris.xlsx';
      break;
    case 'kebersihan':
      headers = ['NAMA ITEM', 'KATEGORI (alat_kebersihan/tempat_sampah/area_pembuangan/lainnya)', 'ASRAMA (Asrama A/B/C/D/E/F/Tahfid)', 'JUMLAH', 'KONDISI (Bersih/Kotor Ringan/Kotor Berat)', 'KETERANGAN'];
      exampleRow = ['Tempat Sampah Kamar', 'tempat_sampah', 'Asrama B', '2', 'Bersih', 'Tempat sampah plastik'];
      filename = 'Templat_Impor_Kebersihan.xlsx';
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
