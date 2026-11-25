export function calcPredikat(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  if (score > 0) return 'E';
  return '-';
}

export function isEmptyScoreVal(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
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
