-- ============================================================
-- SQL SYNC KELAS MADIN UNTUK PRODUCTION DATABASE
-- Total: 57 santri (45 via smart script + 12 via Kategori 1)
-- Tanggal: 2026-08-04
-- Jalankan di phpMyAdmin production: ppmawaro_absensi_ppma
-- ============================================================

-- === KATEGORI 1: HAMPIR PASTI MATCH (12 santri) ===
UPDATE murid SET kelas_madin_id = 16 WHERE nama = 'AISYAH REGINA FAHMI AZ-ZAHRA'; -- 1 WUSTHO (C) PUTRI
UPDATE murid SET kelas_madin_id = 30 WHERE nama = 'NAILATUN NUR LAILATUL QUDSIYAH'; -- 3 ULA (A) PUTRI
UPDATE murid SET kelas_madin_id = 31 WHERE nama = 'NAURAH KHUNI`ATUN MUBAYYINA'; -- 3 ULA (B) PUTRI
UPDATE murid SET kelas_madin_id = 32 WHERE nama = 'ATHIIYAH AULIYA`UL MUSHOFAROH'; -- 3 ULA (C) PUTRI
UPDATE murid SET kelas_madin_id = 32 WHERE nama = 'NATASYA ANGELINA AMANDA FERDIANA'; -- 3 ULA (C) PUTRI
UPDATE murid SET kelas_madin_id = 21 WHERE nama = 'FARIKHTA RAMADHANI RIDWAN'; -- 3 WUSTHO (A) PUTRI
UPDATE murid SET kelas_madin_id = 35 WHERE nama = 'DEWI SHOFIYAH NUR HIMMATUSSALAFIYA'; -- 3 MAK PUTRI
UPDATE murid SET kelas_madin_id = 35 WHERE nama = 'FIRNANDA KHOLAGUL HIDAYATUS MUAWIYAH'; -- 3 MAK PUTRI
UPDATE murid SET kelas_madin_id = 27 WHERE nama = 'SHOFIE AULIA AFIQAH MARSAID'; -- 2 ULA (A) PUTRI
UPDATE murid SET kelas_madin_id = 27 WHERE nama = 'DAFINAH ALISHA BATRISYA HARIANTO'; -- 2 ULA (A) PUTRI
UPDATE murid SET kelas_madin_id = 29 WHERE nama = 'ANISA RETNO LULUK NUR MANGGALI'; -- 2 ULA (C) PUTRI
UPDATE murid SET kelas_madin_id = 19 WHERE nama = 'ZAIMAH LULU AZKIYAH'; -- 2 WUSTHO (B) PUTRI

-- === CATATAN ===
-- Untuk 45 santri lainnya (smart prefix match 94-100%):
-- Sudah di-sync via Impor Cerdas + script lokal.
-- Karena production DB belum ter-update, silakan upload ulang
-- file Excel berikut via tombol "Impor Cerdas" di production:
--   1. SANTRI PUTRA FIKS 2026.xlsx
--   2. SANTRI BARU PUTRI FIKS 2026.xlsx
--   3. SANTRI LAMA PUTRI 2 fiks.xlsx
-- Dan jalankan SQL di atas via phpMyAdmin.
