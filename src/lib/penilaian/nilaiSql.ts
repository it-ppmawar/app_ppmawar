/** Kondisi SQL untuk mendeteksi baris nilai_santri kosong/residu (seluruh skor 0/NULL tanpa predikat A–E dan tanpa catatan). */
export function residualZeroConditionSql(alias = ''): string {
  const p = alias ? `${alias}.` : '';
  return `(
    COALESCE(${p}nilai_harian, 0) = 0
    AND COALESCE(${p}nilai_lisan, 0) = 0
    AND COALESCE(${p}nilai_uts, 0) = 0
    AND COALESCE(${p}nilai_uas, 0) = 0
    AND COALESCE(${p}nilai_akhir, 0) = 0
    AND (${p}predikat IS NULL OR TRIM(${p}predikat) IN ('', '-'))
    AND (${p}catatan IS NULL OR TRIM(${p}catatan) = '')
  )`;
}
