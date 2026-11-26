import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import {
  DEFAULT_SEMESTER_PERIODE_CONFIG,
  PeriodeFilterMode,
  SEMESTER_SETTING_KEYS,
  SemesterPeriodeConfig,
} from './semesterPeriode';

/** Memetakan baris key-value pengaturan DB menjadi objek SemesterPeriodeConfig yang tervalidasi. */
export function parseSemesterPeriodeConfig(
  raw: Record<string, string | undefined>
): SemesterPeriodeConfig {
  const modeRaw = raw.periode_filter_mode;
  const mode: PeriodeFilterMode =
    modeRaw === 'otomatis' || modeRaw === 'kustom' || modeRaw === 'semua'
      ? modeRaw
      : DEFAULT_SEMESTER_PERIODE_CONFIG.periode_filter_mode;

  return {
    semester_aktif:
      raw.semester_aktif === '1' || raw.semester_aktif === '2'
        ? raw.semester_aktif
        : DEFAULT_SEMESTER_PERIODE_CONFIG.semester_aktif,
    tahun_ajaran_aktif:
      (raw.tahun_ajaran_aktif || '').trim() || DEFAULT_SEMESTER_PERIODE_CONFIG.tahun_ajaran_aktif,
    periode_filter_mode: mode,
    periode_sem1_mulai: (raw.periode_sem1_mulai || '').trim(),
    periode_sem1_selesai: (raw.periode_sem1_selesai || '').trim(),
    periode_sem2_mulai: (raw.periode_sem2_mulai || '').trim(),
    periode_sem2_selesai: (raw.periode_sem2_selesai || '').trim(),
  };
}

/** Mengambil konfigurasi periode akademik aktif & rentang tanggal semester dari database. */
export async function getSemesterPeriodeConfig(): Promise<SemesterPeriodeConfig> {
  try {
    const placeholders = SEMESTER_SETTING_KEYS.map(() => '?').join(',');
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT nama_pengaturan, nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan IN (${placeholders})`,
      [...SEMESTER_SETTING_KEYS]
    );
    const map: Record<string, string> = {};
    rows.forEach(row => {
      map[row.nama_pengaturan] = row.nilai;
    });
    return parseSemesterPeriodeConfig(map);
  } catch (err) {
    console.warn('Gagal mengambil konfigurasi periode semester:', err);
    return { ...DEFAULT_SEMESTER_PERIODE_CONFIG };
  }
}
