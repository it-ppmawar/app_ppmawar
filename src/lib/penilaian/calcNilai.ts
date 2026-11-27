export function calcPredikat(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score > 0) return 'E';
  return '-';
}

/** Konversi input nilai akhir (string/number) menjadi predikat A–E, membedakan angka 0 ('E') dari nilai kosong. */
export function calcPredikatFromInput(val: unknown, emptyFallback = ''): string {
  if (isEmptyScoreVal(val)) return emptyFallback;
  const num = parseFloat(String(val));
  if (isNaN(num)) return emptyFallback;
  return num === 0 ? 'E' : calcPredikat(num);
}

export function isEmptyScoreVal(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

export function isEmptyPredikat(v: unknown): boolean {
  return isEmptyScoreVal(v) || String(v).trim() === '-';
}

export function isZeroOrEmptyScoreVal(v: unknown): boolean {
  if (isEmptyScoreVal(v)) return true;
  const num = Number(v);
  return !isNaN(num) && num === 0;
}

export interface ScoreFieldsLike {
  harian?: unknown;
  lisan?: unknown;
  uts?: unknown;
  uas?: unknown;
  akhir?: unknown;
  nilai_harian?: unknown;
  nilai_lisan?: unknown;
  nilai_uts?: unknown;
  nilai_uas?: unknown;
  nilai_akhir?: unknown;
  predikat?: unknown;
  catatan?: unknown;
}

/** Mengecek apakah baris hanya berisi nol/kosong residu tanpa predikat A–E maupun catatan. */
export function isResidualZeroScoreRow(row: ScoreFieldsLike | null | undefined): boolean {
  if (!row) return true;
  const h = row.harian !== undefined ? row.harian : row.nilai_harian;
  const l = row.lisan !== undefined ? row.lisan : row.nilai_lisan;
  const u = row.uts !== undefined ? row.uts : row.nilai_uts;
  const a = row.uas !== undefined ? row.uas : row.nilai_uas;
  const akh = row.akhir !== undefined ? row.akhir : row.nilai_akhir;

  return (
    isZeroOrEmptyScoreVal(h) &&
    isZeroOrEmptyScoreVal(l) &&
    isZeroOrEmptyScoreVal(u) &&
    isZeroOrEmptyScoreVal(a) &&
    isZeroOrEmptyScoreVal(akh) &&
    isEmptyPredikat(row.predikat) &&
    isEmptyScoreVal(row.catatan)
  );
}

/** Mengecek apakah santri benar-benar memiliki minimal satu komponen nilai yang terisi. */
export function hasFilledGrade(row: ScoreFieldsLike | null | undefined): boolean {
  if (!row || isResidualZeroScoreRow(row)) return false;
  const h = row.harian !== undefined ? row.harian : row.nilai_harian;
  const l = row.lisan !== undefined ? row.lisan : row.nilai_lisan;
  const u = row.uts !== undefined ? row.uts : row.nilai_uts;
  const a = row.uas !== undefined ? row.uas : row.nilai_uas;
  const akh = row.akhir !== undefined ? row.akhir : row.nilai_akhir;

  return (
    !isEmptyScoreVal(h) ||
    !isEmptyScoreVal(l) ||
    !isEmptyScoreVal(u) ||
    !isEmptyScoreVal(a) ||
    !isEmptyScoreVal(akh)
  );
}

export function parseClampedScore(v: unknown): number {
  const n = Number(v);
  if (isNaN(n)) return 0;
  return Math.min(Math.max(n, 0), 100);
}

/**
 * Kalkulasi otomatis Nilai Akhir:
 * - Jika Nilai Ujian Lisan terisi (bukan kosong/null): 25% Harian + 25% Lisan + 25% UTS + 25% UAS
 * - Jika Nilai Ujian Lisan kosong/null (mapel non-lisan): 30% Harian + 30% UTS + 40% UAS
 */
export function calcNilaiAkhir(params: {
  harian: unknown;
  lisan?: unknown;
  uts: unknown;
  uas: unknown;
}): number | null {
  const hasH = !isEmptyScoreVal(params.harian);
  const hasL = !isEmptyScoreVal(params.lisan);
  const hasU = !isEmptyScoreVal(params.uts);
  const hasA = !isEmptyScoreVal(params.uas);

  if (!hasH && !hasL && !hasU && !hasA) return null;

  const h = hasH ? parseClampedScore(params.harian) : 0;
  const l = hasL ? parseClampedScore(params.lisan) : 0;
  const u = hasU ? parseClampedScore(params.uts) : 0;
  const a = hasA ? parseClampedScore(params.uas) : 0;

  if (hasL) {
    return Math.round(((h + l + u + a) * 0.25) * 100) / 100;
  }
  return Math.round((h * 0.3 + u * 0.3 + a * 0.4) * 100) / 100;
}

export const DEFAULT_PENGATURAN_NILAI = {
  batas_nilai_tuntas: 70,
  keterangan_tuntas: 'Tuntas',
  keterangan_bimbingan: 'Perlu Bimbingan',
} as const;

export interface PengaturanNilaiLike {
  batas_nilai_tuntas?: unknown;
  keterangan_tuntas?: unknown;
  keterangan_bimbingan?: unknown;
}

/** Menormalkan KKM dan label keterangan nilai raport dari pengaturan tersimpan serta override form. */
export function resolvePengaturanNilai(
  saved?: PengaturanNilaiLike | null,
  overrides?: PengaturanNilaiLike | null
) {
  const overrideBatas = overrides?.batas_nilai_tuntas;
  const hasOverrideBatas =
    overrideBatas !== undefined &&
    overrideBatas !== null &&
    String(overrideBatas).trim() !== '';
  const parsedBatas = Number(
    hasOverrideBatas
      ? overrideBatas
      : saved?.batas_nilai_tuntas ?? DEFAULT_PENGATURAN_NILAI.batas_nilai_tuntas
  );
  const batasNilaiTuntas = Number.isFinite(parsedBatas)
    ? Math.min(100, Math.max(0, parsedBatas))
    : DEFAULT_PENGATURAN_NILAI.batas_nilai_tuntas;

  const pickLabel = (overrideVal: unknown, savedVal: unknown, fallback: string) => {
    const ov = overrideVal !== undefined && overrideVal !== null ? String(overrideVal).trim() : '';
    if (ov) return ov;
    const sv = savedVal !== undefined && savedVal !== null ? String(savedVal).trim() : '';
    return sv || fallback;
  };

  return {
    batasNilaiTuntas,
    batasLabel: batasNilaiTuntas.toLocaleString('id-ID', { maximumFractionDigits: 2 }),
    keteranganTuntas: pickLabel(
      overrides?.keterangan_tuntas,
      saved?.keterangan_tuntas,
      DEFAULT_PENGATURAN_NILAI.keterangan_tuntas
    ),
    keteranganBimbingan: pickLabel(
      overrides?.keterangan_bimbingan,
      saved?.keterangan_bimbingan,
      DEFAULT_PENGATURAN_NILAI.keterangan_bimbingan
    ),
  };
}
