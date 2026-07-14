/**
 * Modul Utilitas Kalender Pasaran Jawa
 * 
 * Menghitung hari pasaran Jawa (Pancawara) dari tanggal Masehi.
 * Urutan pasaran: Wage, Kliwon, Legi, Pahing, Pon
 * 
 * Referensi: 1 Januari 1970 (Unix Epoch) = Kamis Wage
 * Terverifikasi dengan kalender resmi Jawa (Kompas, Detik, Tirto).
 */

const PASARAN = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'] as const;
export type Pasaran = typeof PASARAN[number];

/**
 * Menghitung pasaran Jawa dari tanggal Masehi.
 * @param date - Objek Date JavaScript
 * @returns Nama pasaran Jawa (Wage, Kliwon, Legi, Pahing, Pon)
 */
export const getPasaranJawa = (date: Date): Pasaran => {
  // Referensi: 1970-01-01 UTC = Kamis Wage (index 0 dalam array PASARAN)
  const refDate = new Date('1970-01-01T00:00:00Z');
  const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const diffMs = targetDate.getTime() - refDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const idx = ((diffDays % 5) + 5) % 5; // Pastikan selalu positif
  return PASARAN[idx];
};

/**
 * Mengecek apakah tanggal tertentu adalah Ahad Legi.
 * @param date - Objek Date JavaScript
 * @returns true jika hari Ahad (Minggu) dan pasaran Legi
 */
export const isAhadLegi = (date: Date): boolean => {
  return date.getDay() === 0 && getPasaranJawa(date) === 'Legi';
};

/**
 * Menghitung tanggal Ahad Legi berikutnya dari tanggal tertentu.
 * @param fromDate - Tanggal mulai pencarian (default: hari ini)
 * @returns Objek Date untuk Ahad Legi berikutnya
 */
export const getNextAhadLegi = (fromDate: Date = new Date()): Date => {
  const date = new Date(fromDate);
  // Mulai dari hari berikutnya
  date.setDate(date.getDate() + 1);
  
  // Cari sampai 365 hari ke depan (pasti ketemu dalam 35 hari = LCM(5,7))
  for (let i = 0; i < 365; i++) {
    if (isAhadLegi(date)) return date;
    date.setDate(date.getDate() + 1);
  }
  
  return date; // Fallback (seharusnya tidak pernah sampai sini)
};

/**
 * Menghitung daftar tanggal Ahad Legi dalam rentang waktu tertentu.
 * @param startDate - Tanggal mulai
 * @param endDate - Tanggal akhir
 * @returns Array tanggal Ahad Legi dalam rentang tersebut
 */
export const getAhadLegiInRange = (startDate: Date, endDate: Date): Date[] => {
  const result: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isAhadLegi(current)) {
      result.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return result;
};

/**
 * Mendapatkan nama hari dalam Bahasa Indonesia.
 */
export const getHariIndonesia = (date: Date): string => {
  const hari = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return hari[date.getDay()];
};

/**
 * Mendapatkan weton lengkap (Hari + Pasaran) dari tanggal Masehi.
 * Contoh: "Kamis Kliwon"
 */
export const getWeton = (date: Date): string => {
  return `${getHariIndonesia(date)} ${getPasaranJawa(date)}`;
};

export { PASARAN };
