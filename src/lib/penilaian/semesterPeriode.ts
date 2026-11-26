export type PeriodeFilterMode = 'semua' | 'otomatis' | 'kustom';

export interface SemesterPeriodeConfig {
  semester_aktif: string;
  tahun_ajaran_aktif: string;
  periode_filter_mode: PeriodeFilterMode;
  periode_sem1_mulai: string;
  periode_sem1_selesai: string;
  periode_sem2_mulai: string;
  periode_sem2_selesai: string;
}

export interface SemesterDateRange {
  startDate?: string;
  endDate?: string;
  mode: PeriodeFilterMode;
}

export const SEMESTER_SETTING_KEYS = [
  'semester_aktif',
  'tahun_ajaran_aktif',
  'periode_filter_mode',
  'periode_sem1_mulai',
  'periode_sem1_selesai',
  'periode_sem2_mulai',
  'periode_sem2_selesai',
] as const;

export const DEFAULT_SEMESTER_PERIODE_CONFIG: SemesterPeriodeConfig = {
  semester_aktif: '1',
  tahun_ajaran_aktif: '2025/2026',
  periode_filter_mode: 'semua',
  periode_sem1_mulai: '',
  periode_sem1_selesai: '',
  periode_sem2_mulai: '',
  periode_sem2_selesai: '',
};

const BASE_TAHUN_AJARAN_OPTIONS = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];

/** Daftar opsi Tahun Ajaran untuk dropdown filter (menjamin nilai aktif selalu termasuk). */
export function getTahunAjaranOptions(extraYear?: string | null): string[] {
  const list = [...BASE_TAHUN_AJARAN_OPTIONS];
  const trimmed = extraYear ? extraYear.trim() : '';
  if (trimmed && !list.includes(trimmed)) {
    list.push(trimmed);
    list.sort();
  }
  return list;
}

/** Validasi format tanggal ISO YYYY-MM-DD agar aman dipakai pada query tanggal SQL. */
export function isValidIsoDate(val?: string | null): val is string {
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Hitung rentang tanggal standar kalender pendidikan: Sem 1 (Jul-Des), Sem 2 (Jan-Jun). */
export function getStandardSemesterDates(
  semester: string,
  tahunAjaran: string
): { startDate: string; endDate: string } | null {
  const match = String(tahunAjaran || '').trim().match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);

  if (String(semester) === '2') {
    return {
      startDate: `${endYear}-01-01`,
      endDate: `${endYear}-06-30`,
    };
  }
  return {
    startDate: `${startYear}-07-01`,
    endDate: `${startYear}-12-31`,
  };
}

/**
 * Menentukan rentang tanggal aktif untuk filter presensi & pelanggaran pada semester dan tahun ajaran tertentu.
 * Mengembalikan null bila mode = 'semua' atau rentang tanggal kustom tidak valid.
 */
export function resolveSemesterDateRange(
  semester: string,
  tahunAjaran: string,
  config: Partial<SemesterPeriodeConfig>
): SemesterDateRange | null {
  const mode: PeriodeFilterMode =
    config.periode_filter_mode === 'otomatis' || config.periode_filter_mode === 'kustom'
      ? config.periode_filter_mode
      : 'semua';

  if (mode === 'semua') {
    return null;
  }

  // Untuk mode kustom yang hanya diset bagi tahun ajaran aktif, gunakan standar kalender saat melihat TA lain
  const activeTA = (config.tahun_ajaran_aktif || '').trim();
  const isCustomForCurrentTA = !activeTA || String(tahunAjaran || '').trim() === activeTA;

  if (mode === 'kustom' && isCustomForCurrentTA) {
    const rawStart = String(semester) === '2' ? config.periode_sem2_mulai : config.periode_sem1_mulai;
    const rawEnd = String(semester) === '2' ? config.periode_sem2_selesai : config.periode_sem1_selesai;
    const startDate = isValidIsoDate(rawStart) ? rawStart : undefined;
    const endDate = isValidIsoDate(rawEnd) ? rawEnd : undefined;

    if (!startDate && !endDate) {
      return null;
    }
    if (startDate && endDate && startDate > endDate) {
      return null;
    }
    return { startDate, endDate, mode: 'kustom' };
  }

  const std = getStandardSemesterDates(semester, tahunAjaran);
  if (!std) return null;
  return { ...std, mode: 'otomatis' };
}

/** Membangun klausa SQL AND untuk memfilter kolom tanggal berdasarkan rentang periode semester. */
export function buildDateWhereClause(
  columnName: string,
  range: SemesterDateRange | null
): { clause: string; params: string[] } {
  if (!range) return { clause: '', params: [] };
  if (range.startDate && range.endDate) {
    return { clause: `AND ${columnName} BETWEEN ? AND ?`, params: [range.startDate, range.endDate] };
  }
  if (range.startDate) {
    return { clause: `AND ${columnName} >= ?`, params: [range.startDate] };
  }
  if (range.endDate) {
    return { clause: `AND ${columnName} <= ?`, params: [range.endDate] };
  }
  return { clause: '', params: [] };
}

const BULAN_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Format ringkas YYYY-MM-DD menjadi "1 Jul 2026" untuk pratinjau di halaman pengaturan. */
export function formatTanggalIndoShort(isoDate?: string | null): string {
  if (!isValidIsoDate(isoDate)) return '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${BULAN_SHORT_ID[m - 1] || m} ${y}`;
}
