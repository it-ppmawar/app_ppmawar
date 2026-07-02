<?php
// cron_absensi_otomatis.php
// Skrip ini dijalankan melalui Cron Job untuk menandai 'Alpa' secara otomatis
// bagi guru yang tidak melakukan absensi setelah melewati batas waktu (deadline)
// Contoh cron: 0 * * * * php /path/to/absen.ppma.or.id/cron_absensi_otomatis.php

require_once __DIR__ . '/includes/config.php';

// Set timezone
date_default_timezone_set('Asia/Jakarta');

$hari_ini = date('l');
$tanggal_ini = date('Y-m-d');
$waktu_sekarang = date('H:i:s');
$waktu_lengkap = date('Y-m-d H:i:s');

// Translasi hari ke bahasa Indonesia
$hari_map = [
    'Monday' => 'Senin', 'Tuesday' => 'Selasa', 'Wednesday' => 'Rabu',
    'Thursday' => 'Kamis', 'Friday' => 'Jumat', 'Saturday' => 'Sabtu', 'Sunday' => 'Ahad'
];
$hari_indo = $hari_map[$hari_ini];

echo "=================================================\n";
echo "Menjalankan Auto-Alpa pada $waktu_lengkap\n";
echo "Hari: $hari_indo\n";
echo "=================================================\n";

// =============================================
// CEK MODE LIBUR - Jika aktif, skip semua proses
// =============================================
$cek_libur = $conn->query("SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = 'mode_libur' LIMIT 1");
if ($cek_libur && $cek_libur->num_rows > 0) {
    $row_libur = $cek_libur->fetch_assoc();
    if ($row_libur['nilai'] == '1') {
        echo "MODE LIBUR AKTIF - Proses Auto-Alpa dilewati.\n";
        echo "Aktifkan kembali di Pengaturan Sistem untuk melanjutkan absensi otomatis.\n";
        echo "=================================================\n";
        exit(0);
    }
}

// Cek juga apakah absensi otomatis diaktifkan
$cek_otomatis = $conn->query("SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = 'absensi_otomatis_guru' LIMIT 1");
if ($cek_otomatis && $cek_otomatis->num_rows > 0) {
    $row_otomatis = $cek_otomatis->fetch_assoc();
    if ($row_otomatis['nilai'] != '1') {
        echo "ABSENSI OTOMATIS NONAKTIF - Proses Auto-Alpa dilewati.\n";
        echo "=================================================\n";
        exit(0);
    }
}

$jumlah_alpa = 0;

/**
 * 1. PROSES JADWAL MADIN
 */
echo "\n--- Memeriksa Jadwal Madin ---\n";
// Ambil jadwal yang sudah melewati batas deadline (jam selesai + 1 jam)
// dan belum ada record di tabel absensi_guru
$sql_madin = "SELECT jm.jadwal_id, jm.jam_selesai, COALESCE(NULLIF(jm.guru_id, ''), km.guru_id) as guru_id 
              FROM jadwal_madin jm
              JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
              WHERE jm.hari = '$hari_indo' 
              AND '$waktu_sekarang' > DATE_ADD(jm.jam_selesai, INTERVAL 1 HOUR)";

$result_madin = $conn->query($sql_madin);

while ($row = $result_madin->fetch_assoc()) {
    $guru_id = $row['guru_id'];
    if (empty($guru_id)) continue;
    $jadwal_id = $row['jadwal_id'];
    
    // Cek apakah sudah diabsen manual
    $cek_absen = $conn->query("SELECT * FROM absensi_guru WHERE guru_id = '$guru_id' AND jadwal_madin_id = '$jadwal_id' AND tanggal = '$tanggal_ini'");
    
    if ($cek_absen->num_rows == 0) {
        // Belum diabsen, insert Alpa!
        $deadline_asli = $tanggal_ini . ' ' . date('H:i:s', strtotime($row['jam_selesai']) + 3600);
        $conn->query("INSERT INTO absensi_guru (guru_id, jadwal_madin_id, tanggal, deadline_absensi, status, keterangan, is_otomatis) 
                      VALUES ('$guru_id', '$jadwal_id', '$tanggal_ini', '$deadline_asli', 'Alpa', 'Sistem Auto-Alpa (Melewati Batas Waktu)', 1)");
        $jumlah_alpa++;
        echo "Guru ID $guru_id ditandai ALPA untuk Madin ID $jadwal_id\n";
    } else {
        // Jika sudah ada record tapi statusnya "Belum Absen", update jadi Alpa
        $absen = $cek_absen->fetch_assoc();
        if ($absen['status'] == 'Belum Absen' || empty($absen['status'])) {
            $conn->query("UPDATE absensi_guru SET status = 'Alpa', keterangan = 'Sistem Auto-Alpa (Melewati Batas Waktu)', is_otomatis = 1 WHERE absensi_id = '{$absen['absensi_id']}'");
            $jumlah_alpa++;
            echo "Guru ID $guru_id diperbarui menjadi ALPA untuk Madin ID $jadwal_id\n";
        }
    }
}

/**
 * 2. PROSES JADWAL QURAN
 */
echo "\n--- Memeriksa Jadwal Quran ---\n";
$sql_quran = "SELECT jq.id as jadwal_id, jq.jam_selesai, COALESCE(NULLIF(jq.guru_id, ''), kq.guru_id) as guru_id 
              FROM jadwal_quran jq
              JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
              WHERE jq.hari = '$hari_indo' 
              AND '$waktu_sekarang' > DATE_ADD(jq.jam_selesai, INTERVAL 1 HOUR)";

$result_quran = $conn->query($sql_quran);

while ($row = $result_quran->fetch_assoc()) {
    $guru_id = $row['guru_id'];
    if (empty($guru_id)) continue;
    $jadwal_id = $row['jadwal_id'];
    
    $cek_absen = $conn->query("SELECT * FROM absensi_guru WHERE guru_id = '$guru_id' AND jadwal_quran_id = '$jadwal_id' AND tanggal = '$tanggal_ini'");
    
    if ($cek_absen->num_rows == 0) {
        $deadline_asli = $tanggal_ini . ' ' . date('H:i:s', strtotime($row['jam_selesai']) + 3600);
        $conn->query("INSERT INTO absensi_guru (guru_id, jadwal_quran_id, tanggal, deadline_absensi, status, keterangan, is_otomatis) 
                      VALUES ('$guru_id', '$jadwal_id', '$tanggal_ini', '$deadline_asli', 'Alpa', 'Sistem Auto-Alpa (Melewati Batas Waktu)', 1)");
        $jumlah_alpa++;
        echo "Guru ID $guru_id ditandai ALPA untuk Quran ID $jadwal_id\n";
    } else {
        $absen = $cek_absen->fetch_assoc();
        if ($absen['status'] == 'Belum Absen' || empty($absen['status'])) {
            $conn->query("UPDATE absensi_guru SET status = 'Alpa', keterangan = 'Sistem Auto-Alpa (Melewati Batas Waktu)', is_otomatis = 1 WHERE absensi_id = '{$absen['absensi_id']}'");
            $jumlah_alpa++;
            echo "Guru ID $guru_id diperbarui menjadi ALPA untuk Quran ID $jadwal_id\n";
        }
    }
}

/**
 * 3. PROSES JADWAL KEGIATAN
 */
echo "\n--- Memeriksa Jadwal Kegiatan ---\n";
$sql_kegiatan = "SELECT jk.kegiatan_id as jadwal_id, jk.jam_selesai, COALESCE(NULLIF(jk.guru_id, ''), k.guru_id) as guru_id 
                 FROM jadwal_kegiatan jk
                 JOIN kamar k ON jk.kamar_id = k.kamar_id
                 WHERE jk.hari = '$hari_indo' 
                 AND '$waktu_sekarang' > DATE_ADD(jk.jam_selesai, INTERVAL 1 HOUR)";

$result_kegiatan = $conn->query($sql_kegiatan);

while ($row = $result_kegiatan->fetch_assoc()) {
    $guru_id = $row['guru_id'];
    if (empty($guru_id)) continue;
    $jadwal_id = $row['jadwal_id'];
    
    $cek_absen = $conn->query("SELECT * FROM absensi_guru WHERE guru_id = '$guru_id' AND kegiatan_id = '$jadwal_id' AND tanggal = '$tanggal_ini'");
    
    if ($cek_absen->num_rows == 0) {
        $deadline_asli = $tanggal_ini . ' ' . date('H:i:s', strtotime($row['jam_selesai']) + 3600);
        $conn->query("INSERT INTO absensi_guru (guru_id, kegiatan_id, tanggal, deadline_absensi, status, keterangan, is_otomatis) 
                      VALUES ('$guru_id', '$jadwal_id', '$tanggal_ini', '$deadline_asli', 'Alpa', 'Sistem Auto-Alpa (Melewati Batas Waktu)', 1)");
        $jumlah_alpa++;
        echo "Guru ID $guru_id ditandai ALPA untuk Kegiatan ID $jadwal_id\n";
    } else {
        $absen = $cek_absen->fetch_assoc();
        if ($absen['status'] == 'Belum Absen' || empty($absen['status'])) {
            $conn->query("UPDATE absensi_guru SET status = 'Alpa', keterangan = 'Sistem Auto-Alpa (Melewati Batas Waktu)', is_otomatis = 1 WHERE absensi_id = '{$absen['absensi_id']}'");
            $jumlah_alpa++;
            echo "Guru ID $guru_id diperbarui menjadi ALPA untuk Kegiatan ID $jadwal_id\n";
        }
    }
}

echo "=================================================\n";
echo "Selesai. Total $jumlah_alpa record guru ditandai sebagai Alpa.\n";
echo "=================================================\n";
?>
