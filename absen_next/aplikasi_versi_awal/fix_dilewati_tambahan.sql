-- ============================================================
-- fix_dilewati_tambahan.sql
-- SQL Perbaikan Tambahan (dari analisis kandidat)
-- Jalankan DI CPANEL setelah fix_dilewati_output.sql
-- ============================================================

-- ============================================================
-- BAGIAN 1: KOREKSI KHUSUS — AUREL salah ke FAJRIYAH
-- ============================================================
-- Foto 1: Kartu asli milik AUREL NUR HABIBATUL LATHIFAH (NIS: 2024070498)
-- Foto 2: QR salah dipasang ke FAJRIYAH NIKMATUS SU`AMAN
-- Catatan: Koreksi ini sudah termasuk dalam fix_dilewati_output.sql
-- (dari file Copy of AUREL NUR HABIBATUL LATHIFAH.jpg)
-- Tapi ditampilkan di sini untuk kejelasan:
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAx2S7+hKwoSSu7tDkpmpdDprq/rI1aW141R6W9Ja5Mlg3cTU3cH3RQRFgO4VQfD2Y=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAx2S7+hKwoSSu7tDkpmpdDprq/rI1aW141R6W9Ja5Mlg3cTU3cH3RQRFgO4VQfD2Y=';
UPDATE murid SET barcode_id = 'djAx2S7+hKwoSSu7tDkpmpdDprq/rI1aW141R6W9Ja5Mlg3cTU3cH3RQRFgO4VQfD2Y=' WHERE nis = '2024070498';
-- Hasil: Kartu Aurel kembali ke Aurel, Fajriyah tidak punya barcode (perlu scan ulang)

-- ============================================================
-- BAGIAN 2: MATCH OTOMATIS (Score 80-100% — SANGAT YAKIN)
-- ============================================================
-- [MATCH-100%] HALIMATUS SA`ADAH.jpg => GURU Ustd. Halimatus sa'adah
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxHGwbbewjmX0KLj+oGfGB7xL9iYq5GN4mT6nJIktbzSiBHMTUBoCX8FbEtfP3FO0=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxHGwbbewjmX0KLj+oGfGB7xL9iYq5GN4mT6nJIktbzSiBHMTUBoCX8FbEtfP3FO0=';
UPDATE guru  SET barcode_id = 'djAxHGwbbewjmX0KLj+oGfGB7xL9iYq5GN4mT6nJIktbzSiBHMTUBoCX8FbEtfP3FO0=' WHERE guru_id = 87;

-- [MATCH-100%] MUHAMMAD NADHIF.jpg => GURU Ust. Nadhif
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxhU/S1DlMKmf9N1z1whLlCjkJCkbHwmyq6/bMdy/kE67FqgjDcHVKI55L7UVfKi4=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxhU/S1DlMKmf9N1z1whLlCjkJCkbHwmyq6/bMdy/kE67FqgjDcHVKI55L7UVfKi4=';
UPDATE guru  SET barcode_id = 'djAxhU/S1DlMKmf9N1z1whLlCjkJCkbHwmyq6/bMdy/kE67FqgjDcHVKI55L7UVfKi4=' WHERE guru_id = 41;

-- [MATCH-100%] NAJIHATU AZMI.jpg => GURU Ustd. Najiha Azmi
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxBwLEt//Zolgm6HgicBVh8pyxAqXMa/Y87uGsxzY/hyH1BnFMlPo8wt12R7SKeuw=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxBwLEt//Zolgm6HgicBVh8pyxAqXMa/Y87uGsxzY/hyH1BnFMlPo8wt12R7SKeuw=';
UPDATE guru  SET barcode_id = 'djAxBwLEt//Zolgm6HgicBVh8pyxAqXMa/Y87uGsxzY/hyH1BnFMlPo8wt12R7SKeuw=' WHERE guru_id = 120;

-- [MATCH-80%] AHMAD FAIZAL REZA.jpg => GURU Ust. Faizal Reza
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxbuIzlDMbNZKBjFCy/OY1FS+VWDtMuPkwbny9Yd1nxscC5JkzHd4yCWQtns2Sv8g=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxbuIzlDMbNZKBjFCy/OY1FS+VWDtMuPkwbny9Yd1nxscC5JkzHd4yCWQtns2Sv8g=';
UPDATE guru  SET barcode_id = 'djAxbuIzlDMbNZKBjFCy/OY1FS+VWDtMuPkwbny9Yd1nxscC5JkzHd4yCWQtns2Sv8g=' WHERE guru_id = 40;

-- [MATCH-80%] AHMAD NUR ATIQ.jpg => GURU Ust. A. Nur Atiq
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxdhf8qeD+9MNqO+XBDc4Pi5Vpl8x5q9llAMMk6b8DTw0BlYluryePvkTqa5ZqnKw=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxdhf8qeD+9MNqO+XBDc4Pi5Vpl8x5q9llAMMk6b8DTw0BlYluryePvkTqa5ZqnKw=';
UPDATE guru  SET barcode_id = 'djAxdhf8qeD+9MNqO+XBDc4Pi5Vpl8x5q9llAMMk6b8DTw0BlYluryePvkTqa5ZqnKw=' WHERE guru_id = 36;

-- [MATCH-80%] GILANG SETYO PRATOMO.jpg => GURU Ust. Gilang Setyo P.
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxYvggK5+kqmvCuU5UjEywcRerk7pQyzPpdJgHqBrCxs4rdlsOu909oW6xcMJZ1/8=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxYvggK5+kqmvCuU5UjEywcRerk7pQyzPpdJgHqBrCxs4rdlsOu909oW6xcMJZ1/8=';
UPDATE guru  SET barcode_id = 'djAxYvggK5+kqmvCuU5UjEywcRerk7pQyzPpdJgHqBrCxs4rdlsOu909oW6xcMJZ1/8=' WHERE guru_id = 46;


-- ============================================================
-- BAGIAN 3: MATCH PERLU KONFIRMASI (Score 57-67%)
-- Periksa sebelum dijalankan — hapus baris yang tidak yakin
-- ============================================================
-- [MATCH-67%] AHMAD IKMALUL FIKRI.jpg => GURU Ust. Achmad Ikmalul Fikri
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxYH/M/HX4JeEKOc8HRZbVL9PNfBSmh3uYgogS5SUqZ8nx5N7dGOMw/P1h6RmGvbU=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxYH/M/HX4JeEKOc8HRZbVL9PNfBSmh3uYgogS5SUqZ8nx5N7dGOMw/P1h6RmGvbU=';
UPDATE guru  SET barcode_id = 'djAxYH/M/HX4JeEKOc8HRZbVL9PNfBSmh3uYgogS5SUqZ8nx5N7dGOMw/P1h6RmGvbU=' WHERE guru_id = 50;

-- [MATCH-67%] ANINTIAS LAILI FIRDANA.jpg => MURID ANINTIAS LAILI FIRDANIA
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxx6wlsfwmIJhsrnHM5o4AuCwj39C1OHlZSX6y+A+VP5fxZ7W+49OnXIVTkrlkXJg=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxx6wlsfwmIJhsrnHM5o4AuCwj39C1OHlZSX6y+A+VP5fxZ7W+49OnXIVTkrlkXJg=';
UPDATE murid SET barcode_id = 'djAxx6wlsfwmIJhsrnHM5o4AuCwj39C1OHlZSX6y+A+VP5fxZ7W+49OnXIVTkrlkXJg=' WHERE nis = '2025070354';

-- [MATCH-67%] FANI NUR AFIFAH.jpg => GURU Ustd. Fany Nur Afifah
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAx6YZ3I/loZ0HkNRL3oliEn+oNlyyEffO6JqcdhP5VMv/q376gLp2SJMscX//rSew=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAx6YZ3I/loZ0HkNRL3oliEn+oNlyyEffO6JqcdhP5VMv/q376gLp2SJMscX//rSew=';
UPDATE guru  SET barcode_id = 'djAx6YZ3I/loZ0HkNRL3oliEn+oNlyyEffO6JqcdhP5VMv/q376gLp2SJMscX//rSew=' WHERE guru_id = 111;

-- [MATCH-67%] FATIKH AFAN KURNIAWAN.jpg => GURU Ust. Fatikh Affan Kurniawan
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxGGcl5j00tdHUPAQgEzz459I5K+bfTKEayMyqc3g6FNEn3Va4bn4elcryKf8qCWU=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxGGcl5j00tdHUPAQgEzz459I5K+bfTKEayMyqc3g6FNEn3Va4bn4elcryKf8qCWU=';
UPDATE guru  SET barcode_id = 'djAxGGcl5j00tdHUPAQgEzz459I5K+bfTKEayMyqc3g6FNEn3Va4bn4elcryKf8qCWU=' WHERE guru_id = 42;

-- [MATCH-67%] HENIS INSYIROTUL AZIIDAH.jpg => GURU Ustd. Henis Insyirotul Azidah
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxICfjwMHj7kQxD8J6P5r+g6Pg1xYoX7tW3dbdpHVJdzxrSQOQOi7FafnnaxQtw4Q=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxICfjwMHj7kQxD8J6P5r+g6Pg1xYoX7tW3dbdpHVJdzxrSQOQOi7FafnnaxQtw4Q=';
UPDATE guru  SET barcode_id = 'djAxICfjwMHj7kQxD8J6P5r+g6Pg1xYoX7tW3dbdpHVJdzxrSQOQOi7FafnnaxQtw4Q=' WHERE guru_id = 84;

-- [MATCH-67%] IFATUR ROHMAH.jpg => GURU Hj. Iffaturohmah
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxcroO2dMWFmfnX6q2tUNFJHbkOQmkvay/IBIZGcSQKpXqRbcIHdFWoqbtZ1ocP0A=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxcroO2dMWFmfnX6q2tUNFJHbkOQmkvay/IBIZGcSQKpXqRbcIHdFWoqbtZ1ocP0A=';
UPDATE guru  SET barcode_id = 'djAxcroO2dMWFmfnX6q2tUNFJHbkOQmkvay/IBIZGcSQKpXqRbcIHdFWoqbtZ1ocP0A=' WHERE guru_id = 115;

-- [MATCH-67%] MOH. SYAFIQ SUFYAN KHOIRUR R.jpg => GURU Agus Syafiq Sufyan KR.
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxHeD+YIq1TZYlO2Ke2ZbDEUD6TL0YaxQC0PROAtSpoHZSvxs5+vHPyRPvRUqZoQg=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxHeD+YIq1TZYlO2Ke2ZbDEUD6TL0YaxQC0PROAtSpoHZSvxs5+vHPyRPvRUqZoQg=';
UPDATE guru  SET barcode_id = 'djAxHeD+YIq1TZYlO2Ke2ZbDEUD6TL0YaxQC0PROAtSpoHZSvxs5+vHPyRPvRUqZoQg=' WHERE guru_id = 7;

-- [MATCH-67%] MOHAMMAD SYAIFULLAH ABID.jpg => GURU Ust. M Syaifullah
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxBfFzw+0D12pwWCJ9aX5loKzgvufJdEeJqV8kbGy6RHaPhxgXHA/kavw+/em/t0Q=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxBfFzw+0D12pwWCJ9aX5loKzgvufJdEeJqV8kbGy6RHaPhxgXHA/kavw+/em/t0Q=';
UPDATE guru  SET barcode_id = 'djAxBfFzw+0D12pwWCJ9aX5loKzgvufJdEeJqV8kbGy6RHaPhxgXHA/kavw+/em/t0Q=' WHERE guru_id = 34;

-- [MATCH-67%] NAJWA DURROTUS TSANIA.jpg => MURID NAJWA DURROTUS TSANIYAH
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxATVivYvx6vxeITtHdSf4zuoPgk0xY0EFiXtmOf5OuicpTeKMoGp1Jh5tnxbjT8k=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxATVivYvx6vxeITtHdSf4zuoPgk0xY0EFiXtmOf5OuicpTeKMoGp1Jh5tnxbjT8k=';
UPDATE murid SET barcode_id = 'djAxATVivYvx6vxeITtHdSf4zuoPgk0xY0EFiXtmOf5OuicpTeKMoGp1Jh5tnxbjT8k=' WHERE nis = '2025070277';

-- [MATCH-67%] NIKLA SOFIYATUL FAIZAH.jpg => GURU Ustd. Nikla Shofiyatul Faizah
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxqkbxdi5UoKrIudYDbUlRNAN1EvnXBfMDzgzldt9dZz8qJRii+MaI4Tjn9ZnXul4=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxqkbxdi5UoKrIudYDbUlRNAN1EvnXBfMDzgzldt9dZz8qJRii+MaI4Tjn9ZnXul4=';
UPDATE guru  SET barcode_id = 'djAxqkbxdi5UoKrIudYDbUlRNAN1EvnXBfMDzgzldt9dZz8qJRii+MaI4Tjn9ZnXul4=' WHERE guru_id = 81;

-- [MATCH-67%] RANI HARITOTUL MAHMUDAH.jpg => MURID RANI HARIROTUL MAHMUDAH
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxMaghTh76SWVLYjicGtdwlc1RBabujiZfgt1nHPGGzZGlYReo/TucIP61iJ0x7O0=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxMaghTh76SWVLYjicGtdwlc1RBabujiZfgt1nHPGGzZGlYReo/TucIP61iJ0x7O0=';
UPDATE murid SET barcode_id = 'djAxMaghTh76SWVLYjicGtdwlc1RBabujiZfgt1nHPGGzZGlYReo/TucIP61iJ0x7O0=' WHERE nis = '2025070588';

-- [MATCH-67%] SALAHUDDIN ABDUL AZIZ.jpg => GURU Ust. Sholahuddin Abdul Aziz
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxAFchUs3iYqwzi9by0F0MnAo3Ld3vbmm/zQkTH9u0lwwB4rM9Ke/5M9diCpaX7pQ=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxAFchUs3iYqwzi9by0F0MnAo3Ld3vbmm/zQkTH9u0lwwB4rM9Ke/5M9diCpaX7pQ=';
UPDATE guru  SET barcode_id = 'djAxAFchUs3iYqwzi9by0F0MnAo3Ld3vbmm/zQkTH9u0lwwB4rM9Ke/5M9diCpaX7pQ=' WHERE guru_id = 44;

-- [MATCH-67%] SITI DJAMILAH, DRA.jpg => GURU Hj. Jamilah
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxZ1Uu6c8jPpnEf5AZxqK6OQI91YmYZCnchkp2SMOPknJncc2T4a19v5ks8Msn6cE=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxZ1Uu6c8jPpnEf5AZxqK6OQI91YmYZCnchkp2SMOPknJncc2T4a19v5ks8Msn6cE=';
UPDATE guru  SET barcode_id = 'djAxZ1Uu6c8jPpnEf5AZxqK6OQI91YmYZCnchkp2SMOPknJncc2T4a19v5ks8Msn6cE=' WHERE guru_id = 56;

-- [MATCH-57%] MUHAMMAD THOMY HILMY AZIZY.jpg => GURU Agus Thomy Hilmy Azizi
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAx/xxWuZHlFImuznV4yt4xyxgPJAt5kXY7uRZJBpLkq8js/O8strcCeDFRjDbVVFk=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAx/xxWuZHlFImuznV4yt4xyxgPJAt5kXY7uRZJBpLkq8js/O8strcCeDFRjDbVVFk=';
UPDATE guru  SET barcode_id = 'djAx/xxWuZHlFImuznV4yt4xyxgPJAt5kXY7uRZJBpLkq8js/O8strcCeDFRjDbVVFk=' WHERE guru_id = 10;

-- [MATCH-57%] M NAQOUIB ASHROFUN NASHR.jpg => GURU Agus Naqouib Ashrofun Nasr
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxEQfzIkNg91InsKmhhVI6IHLHkY9ernLSBaPgR7QdR40bMqARB4RFP2ZjYH91oFQ=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxEQfzIkNg91InsKmhhVI6IHLHkY9ernLSBaPgR7QdR40bMqARB4RFP2ZjYH91oFQ=';
UPDATE guru  SET barcode_id = 'djAxEQfzIkNg91InsKmhhVI6IHLHkY9ernLSBaPgR7QdR40bMqARB4RFP2ZjYH91oFQ=' WHERE guru_id = 9;

-- [MATCH-57%] ZAININA ZUBI ZARRETA.jpg => GURU Ning Zainina Zuby Zarreta
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAxv4r+pRMu4XlmYl0bMw+GREuvfzW9a9BeD8zHiRJ/VrnaOEyALoM6ynwt8Vf5/9A=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAxv4r+pRMu4XlmYl0bMw+GREuvfzW9a9BeD8zHiRJ/VrnaOEyALoM6ynwt8Vf5/9A=';
UPDATE guru  SET barcode_id = 'djAxv4r+pRMu4XlmYl0bMw+GREuvfzW9a9BeD8zHiRJ/VrnaOEyALoM6ynwt8Vf5/9A=' WHERE guru_id = 77;

-- [MATCH-50%] ZULIANA HIDAYATUSZZAHRAH.jpg => MURID ZULIANA HIDAYATUZZAHRAH
UPDATE murid SET barcode_id = NULL WHERE barcode_id = 'djAx6dAO+dihoDLeF6M4bAp8Ksgw3YYaayPmLtqBdlcmazjHkWJLZhjZ3cJlKO80v4Q=';
UPDATE guru  SET barcode_id = NULL WHERE barcode_id = 'djAx6dAO+dihoDLeF6M4bAp8Ksgw3YYaayPmLtqBdlcmazjHkWJLZhjZ3cJlKO80v4Q=';
UPDATE murid SET barcode_id = 'djAx6dAO+dihoDLeF6M4bAp8Ksgw3YYaayPmLtqBdlcmazjHkWJLZhjZ3cJlKO80v4Q=' WHERE nis = '2025070287';

