-- SQL Import untuk Akun Ketua & Staff Asrama A - F
-- Hapus akun lama (opsional) agar tidak konflik
DELETE FROM users WHERE username LIKE 'ketua_asrama_%' OR username LIKE 'staff_asrama_%';

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('ketua_asrama_a', '$2b$10$5N4hpXTsv8YrUpzE89I8m.dcegVPQstPl95Ef6LYCp4XVbXf88Qvq', 'pengurus_asrama', 'Ketua Asrama A', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama A%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('staff_asrama_a', '$2b$10$ZnBlAs6rqQu/2CQUE8T60uANDDQjoJBdkoIkzIBgVtalOdEWTTIa2', 'pengurus_asrama', 'Staff Asrama A', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama A%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('ketua_asrama_b', '$2b$10$JNx3a5CEAnPodJt1ZgfJ/.EYohNJdpKsDCFWwTZQg7H3XbiQAvRQK', 'pengurus_asrama', 'Ketua Asrama B', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama B%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('staff_asrama_b', '$2b$10$4/NIuoliusq7pV5IM2rsregNfzy8bLLvZ0oOWBrjPWSAeYGv5nEdG', 'pengurus_asrama', 'Staff Asrama B', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama B%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('ketua_asrama_c', '$2b$10$tT9euG2GweukkPGTkLGyFePqNuw0dzGEOKj0IwjuQZJ1LWsv0x3vi', 'pengurus_asrama', 'Ketua Asrama C', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama C%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('staff_asrama_c', '$2b$10$95zJ3Uj.Mc4.dez7sDXBuu1I7MD27p6qOFLgksrNeHDRZs1/sVOhK', 'pengurus_asrama', 'Staff Asrama C', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama C%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('ketua_asrama_d', '$2b$10$1vsO35w/9DfuL8YkeWdSquaXCtwL3reCPlxlINID.MhVnylf9XBam', 'pengurus_asrama', 'Ketua Asrama D', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama D%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('staff_asrama_d', '$2b$10$w4Rrb3o.yH07fxOIrvrSGuX8siefDxtNvU9JH2e.gxA1ARzE..u9a', 'pengurus_asrama', 'Staff Asrama D', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama D%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('ketua_asrama_e', '$2b$10$UlZmgWlmmmnoKgTwChwJROeFRFgnIT2dt.BXn07ELmVNOGkYpgl16', 'pengurus_asrama', 'Ketua Asrama E', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama E%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('staff_asrama_e', '$2b$10$P4KSnWosyNU3mSRHKf3ScOTWasCZBnPAy5FmybYHslHBTj1VZ523q', 'pengurus_asrama', 'Staff Asrama E', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama E%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('ketua_asrama_f', '$2b$10$ffnmxYqWxHVkNqsdAHZmUO2stsMWzgI9eez.p1uDamtpAb4l2NpLC', 'pengurus_asrama', 'Ketua Asrama F', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama F%' LIMIT 1));

INSERT INTO users (username, password, role, nama, kamar_id)
VALUES ('staff_asrama_f', '$2b$10$J6O1ETHQCxyxcQbocj2b3OzY9LDiBXws3Fjjf8ez6fzkdfZkngkrS', 'pengurus_asrama', 'Staff Asrama F', (SELECT kamar_id FROM kamar WHERE nama_kamar LIKE '%Asrama F%' LIMIT 1));

-- Note: Password default untuk masing-masing adalah ppma[huruf asrama]123
-- Contoh: ppmaa123, ppmab123, dst.
