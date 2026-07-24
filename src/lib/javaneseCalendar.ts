/**
 * Modul Utilitas Kalender Pasaran Jawa
 * 
 * Menghitung hari pasaran Jawa (Pancawara) dari tanggal Masehi.
 * Urutan pasaran: Wage, Kliwon, Legi, Pahing, Pon
 * 
 * Referensi: 1 Januari 1970 (Unix Epoch) = Kamis Wage
 * Terverifikasi dengan kalender resmi Jawa (Kompas, Detik, Tirto).
 */

export const PASARAN = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'] as const;
export type Pasaran = typeof PASARAN[number];

// Hari Masehi (0=Ahad/Minggu, 1=Senin, ..., 6=Sabtu)
export const HARI_LABELS = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Menghitung pasaran Jawa dari tanggal Masehi.
 */
export const getPasaranJawa = (date: Date): Pasaran => {
  const refDate = new Date('1970-01-01T00:00:00Z');
  const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const diffMs = targetDate.getTime() - refDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const idx = ((diffDays % 5) + 5) % 5;
  return PASARAN[idx];
};

/**
 * Mendapatkan nama hari dalam Bahasa Indonesia.
 */
export const getHariIndonesia = (date: Date): string => {
  return HARI_LABELS[date.getDay()];
};

/**
 * Mendapatkan weton lengkap (Hari + Pasaran). Contoh: "Kamis Kliwon"
 */
export const getWeton = (date: Date): string => {
  return `${getHariIndonesia(date)} ${getPasaranJawa(date)}`;
};

/**
 * Mengecek apakah tanggal tertentu adalah weton target (hari + pasaran tertentu).
 * @param hariIndex - 0=Ahad, 1=Senin, ..., 6=Sabtu
 */
export const isTargetWeton = (date: Date, hariIndex: number, pasaran: Pasaran): boolean => {
  return date.getDay() === hariIndex && getPasaranJawa(date) === pasaran;
};

/**
 * Menghitung tanggal weton target berikutnya (hari + pasaran tertentu).
 */
export const getNextTargetWeton = (fromDate: Date = new Date(), hariIndex: number, pasaran: Pasaran): Date => {
  const date = new Date(fromDate);
  date.setDate(date.getDate() + 1);
  for (let i = 0; i < 365; i++) {
    if (isTargetWeton(date, hariIndex, pasaran)) return date;
    date.setDate(date.getDate() + 1);
  }
  return date;
};

// --- Fungsi spesifik untuk kompatibilitas mundur ---

export const isAhadLegi = (date: Date): boolean => isTargetWeton(date, 0, 'Legi');
export const getNextAhadLegi = (fromDate: Date = new Date()): Date => getNextTargetWeton(fromDate, 0, 'Legi');

export const isSabtuPon = (date: Date): boolean => isTargetWeton(date, 6, 'Pon');
export const getNextSabtuPon = (fromDate: Date = new Date()): Date => getNextTargetWeton(fromDate, 6, 'Pon');

/**
 * Menghitung daftar tanggal weton target dalam rentang waktu tertentu.
 */
export const getWetonInRange = (startDate: Date, endDate: Date, hariIndex: number, pasaran: Pasaran): Date[] => {
  const result: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    if (isTargetWeton(current, hariIndex, pasaran)) result.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return result;
};

// Kompatibilitas mundur
export const getAhadLegiInRange = (startDate: Date, endDate: Date): Date[] =>
  getWetonInRange(startDate, endDate, 0, 'Legi');
