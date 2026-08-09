-- ============================================================
-- MIGRASI 16 SANTRI DARI REKAN TIM
-- Tanggal: 2026-08-06
-- Sumber: 25_SANTRI_BELUM_ADA_DB_ISI_NIM_SEBAGIAN.xlsx
-- ============================================================

-- STEP 1: UPDATE KELAS untuk 7 santri yang sudah ada di DB
UPDATE murid SET kelas_madin_id = 14, updated_at = NOW() WHERE nis = '2024070669'; -- KHANSA NABIIHAH → 1 WUSTHO (A) PUTRI
UPDATE murid SET kelas_madin_id = 3,  updated_at = NOW() WHERE nis = '2025070185'; -- RYAN ARDIANSYAH → 2 WUSTHO (A) PUTRA
UPDATE murid SET kelas_madin_id = 31, updated_at = NOW() WHERE nis = '2024070623'; -- NAURAH KUNIATUN → 3 ULA (B) PUTRI
UPDATE murid SET kelas_madin_id = 32, updated_at = NOW() WHERE nis = '2024070631'; -- ATHIIYAH AULIYAUL → 3 ULA (C) PUTRI
UPDATE murid SET kelas_madin_id = 21, updated_at = NOW() WHERE nis = '2024070043'; -- FARIKHTA RAMADHANI → 3 WUSTHO (A) PUTRI
UPDATE murid SET kelas_madin_id = 27, updated_at = NOW() WHERE nis = '2025070470'; -- SYAIDATUN MAULIDYA → 2 ULA (A) PUTRI
UPDATE murid SET kelas_madin_id = 19, updated_at = NOW() WHERE nis = '2025070210'; -- ZAIMAH LULUK → 2 WUSTHO (B) PUTRI

-- STEP 2: INSERT 2 santri baru yang belum ada di DB
INSERT INTO murid (nama, nis, jenis_kelamin, kelas_madin_id, created_at, updated_at)
SELECT 'SHELSYA KANNAH CYBIELLAH', '2026060161', 'Perempuan', 16, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM murid WHERE nis = '2026060161');

INSERT INTO murid (nama, nis, jenis_kelamin, kelas_madin_id, created_at, updated_at)
SELECT 'TSANIYAH NAILATUL IZZA', '2026060162', 'Perempuan', 16, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM murid WHERE nis = '2026060162');

-- ============================================================
-- CATATAN: 6 santri masih menunggu konfirmasi NIS dari rekan tim:
-- 1. M. DZAKY ABIYASA          → 3 ULA A PUTRA
-- 2. ANIS NUR FAIZAH           → 1 WUSTHO C PUTRI
-- 3. RATU AYU TIRTI NEGORO     → 2 ULA A PUTRI
-- 4. RESA FIDIATUN NISA        → 2 ULA A PUTRI
-- 5. TRYAS NABILA ARSYOY       → 2 ULA B PUTRI
-- 6. RANA RAILIHATUL           → 2 ULA C PUTRI
--
-- 1 santri BOYONG (skip):
-- - SABRINA ZAHRA NURIS SYABANI
-- ============================================================
