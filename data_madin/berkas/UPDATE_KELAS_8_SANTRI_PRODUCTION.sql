-- ============================================================
-- UPDATE KELAS MADIN - 8 SANTRI YANG SUDAH ADA DI DATABASE
-- Sumber: SANTRI_BELUM_ADA_DI_DB_FINAL.xlsx (Hasil audit)
-- Tanggal: 2026-08-06
-- ============================================================

-- 1. M. MARCEL AULIA WICAKSANA → 2 WUSTHO (A) PUTRA (kelas_id=3)
--    Sebelumnya: NULL (belum ada kelas madin)
UPDATE murid SET kelas_madin_id = 3, updated_at = NOW()
WHERE nis = '2025070280';

-- 2. AURA HANNA ZILFAH DLOFWATUL AISY → 2 WUSTHO (A) PUTRI (kelas_id=18)
--    Sebelumnya: 1 WUSTHO (B) PUTRI (kelas_id=15) → salah kelas
UPDATE murid SET kelas_madin_id = 18, updated_at = NOW()
WHERE nis = '2025070411';

-- ============================================================
-- Santri berikut kelas madin-nya SUDAH SESUAI, tidak perlu update:
-- NIS 2024070726 - NAILATUN NUR LAILATUL QUDSIYAH  → 3 ULA (A) PUTRI ✅
-- NIS 2024070523 - NATASYA ANGELINA AMANDA FERDIANA → 3 ULA (C) PUTRI ✅
-- NIS 2024070152 - BALQIS NAYSILLA SABILAH           → 3 WUSTHO (A) PUTRI ✅
-- NIS 2025070593 - SHOFIE AULIA AFIQAH MARSAID       → 2 ULA (A) PUTRI ✅
-- NIS 2025070514 - DAFINAH ALISHA BATRISYA HARIANTO  → 2 ULA (A) PUTRI ✅
-- NIS 2025070598 - ANISA RETNO LULUK NUR MANGGALI    → 2 ULA (C) PUTRI ✅
-- ============================================================
