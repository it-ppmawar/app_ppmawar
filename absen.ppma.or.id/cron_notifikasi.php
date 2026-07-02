<?php
// cron_notifikasi.php
// Skrip ini harus dijalankan melalui Cron Job setiap X menit (misal: 15 menit sekali)
// Contoh cron: */15 * * * * php /path/to/absen.ppma.or.id/cron_notifikasi.php

require_once __DIR__ . '/includes/config.php';

// ==========================================
// PENGATURAN FIREBASE CLOUD MESSAGING (FCM) v1
// ==========================================
// Karena Google mematikan Legacy API, kita harus menggunakan HTTP v1 API.
// 1. Download file JSON dari Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
// 2. Upload file JSON tersebut ke server dan ubah path di bawah ini
define('FIREBASE_CREDENTIALS_PATH', __DIR__ . '/firebase_credentials_ppma.json');

// Set timezone
date_default_timezone_set('Asia/Jakarta');

$hari_ini = date('l');
$tanggal_ini = date('Y-m-d');
$waktu_sekarang = date('H:i:s');

// Translasi hari ke bahasa Indonesia
$hari_map = [
    'Monday' => 'Senin', 'Tuesday' => 'Selasa', 'Wednesday' => 'Rabu',
    'Thursday' => 'Kamis', 'Friday' => 'Jumat', 'Saturday' => 'Sabtu', 'Sunday' => 'Ahad'
];
$hari_indo = $hari_map[$hari_ini];

echo "Mulai mengecek jadwal aktif pada $tanggal_ini $waktu_sekarang ($hari_indo)...\n";

// =============================================
// CEK MODE LIBUR - Jika aktif, skip notifikasi
// =============================================
$cek_libur = $conn->query("SELECT nilai FROM pengaturan_absensi_otomatis WHERE nama_pengaturan = 'mode_libur' LIMIT 1");
if ($cek_libur && $cek_libur->num_rows > 0) {
    $row_libur = $cek_libur->fetch_assoc();
    if ($row_libur['nilai'] == '1') {
        echo "MODE LIBUR AKTIF - Notifikasi absensi tidak dikirim.\n";
        exit(0);
    }
}



/**
 * Fungsi untuk mendapatkan OAuth2 Access Token menggunakan Service Account JSON
 */
function get_fcm_access_token() {
    if (!file_exists(FIREBASE_CREDENTIALS_PATH)) {
        echo "Error: File credentials JSON tidak ditemukan di " . FIREBASE_CREDENTIALS_PATH . "\n";
        return false;
    }

    $credentials = json_decode(file_get_contents(FIREBASE_CREDENTIALS_PATH), true);
    
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $payload = json_encode([
        'iss' => $credentials['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => $credentials['token_uri'],
        'exp' => $now + 3600,
        'iat' => $now
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signatureInput = $base64UrlHeader . "." . $base64UrlPayload;

    $signature = '';
    openssl_sign($signatureInput, $signature, $credentials['private_key'], 'sha256WithRSAEncryption');
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    $jwt = $signatureInput . "." . $base64UrlSignature;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $credentials['token_uri']);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);

    $token_data = json_decode($response, true);
    return $token_data['access_token'] ?? false;
}

/**
 * Fungsi untuk mengirim notifikasi FCM HTTP v1
 */
function kirim_notifikasi_fcm($token, $title, $body, $data = []) {
    $access_token = get_fcm_access_token();
    
    if (!$access_token) {
        echo "Gagal mendapatkan access token FCM.\n";
        return false;
    }

    $credentials = json_decode(file_get_contents(FIREBASE_CREDENTIALS_PATH), true);
    $project_id = $credentials['project_id'];
    $url = "https://fcm.googleapis.com/v1/projects/{$project_id}/messages:send";

    // Format payload HTTP v1
    $fields = [
        'message' => [
            'token' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body
            ],
            'data' => $data,
            'android' => [
                'notification' => [
                    'sound' => 'default'
                ]
            ]
        ]
    ];

    $headers = [
        'Authorization: Bearer ' . $access_token,
        'Content-Type: application/json'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($fields));

    $result = curl_exec($ch);
    
    if ($result === FALSE) {
        echo "FCM Send Error: " . curl_error($ch) . "\n";
    }
    
    curl_close($ch);
    return $result;
}

// 1. CEK JADWAL MADIN AKTIF
$sql_madin = "SELECT jm.jadwal_id, jm.mata_pelajaran, jm.jam_mulai, jm.jam_selesai, km.nama_kelas, 
                     g.guru_id, g.nama as nama_guru, u.fcm_token 
              FROM jadwal_madin jm
              JOIN kelas_madin km ON jm.kelas_madin_id = km.kelas_id
              JOIN guru g ON g.guru_id = COALESCE(NULLIF(jm.guru_id, ''), km.guru_id)
              JOIN users u ON g.user_id = u.id
              WHERE jm.hari = '$hari_indo' 
              AND '$waktu_sekarang' >= jm.jam_mulai 
              AND '$waktu_sekarang' <= DATE_ADD(jm.jam_selesai, INTERVAL 1 HOUR)
              AND u.fcm_token IS NOT NULL AND u.fcm_token != ''";

$result_madin = $conn->query($sql_madin);

while ($row = $result_madin->fetch_assoc()) {
    // Cek apakah guru sudah absen di tabel absensi_guru
    $guru_id = $row['guru_id'];
    if (empty($guru_id)) continue;
    $jadwal_id = $row['jadwal_id'];
    
    $cek_absen = $conn->query("SELECT * FROM absensi_guru 
                               WHERE guru_id = '$guru_id' AND jadwal_madin_id = '$jadwal_id' 
                               AND tanggal = '$tanggal_ini'");
                               
    if ($cek_absen->num_rows == 0) {
        // Belum absen! Kirim Notifikasi
        $title = "⏰ Peringatan Absensi Madin";
        $body = "Ustadz/ah {$row['nama_guru']}, jadwal {$row['mata_pelajaran']} di kelas {$row['nama_kelas']} sedang berlangsung. Segera lakukan absensi!";
        
        echo "Mengirim ke {$row['nama_guru']} (Madin)...\n";
        $hasil = kirim_notifikasi_fcm($row['fcm_token'], $title, $body, ['url' => '/pages/dashboard.php']);
        
        // Tandai bahwa notifikasi otomatis sudah dikirim dengan menyisipkan baris awal (karena data absensi di-generate per jadwal atau insert otomatis)
        // Jika data absensi sudah di-generate sebelumnya tapi status masih 'Belum', maka update:
        $conn->query("INSERT INTO absensi_guru (guru_id, jadwal_madin_id, tanggal, notifikasi_terkirim) 
                      VALUES ('$guru_id', '$jadwal_id', '$tanggal_ini', 1) 
                      ON DUPLICATE KEY UPDATE notifikasi_terkirim = 1");
    } else {
        $absen = $cek_absen->fetch_assoc();
        if ($absen['status'] == 'Belum Absen' && $absen['notifikasi_terkirim'] == 0) {
            // Belum absen dan belum dinotifikasi
            $title = "⏰ Peringatan Absensi Madin";
            $body = "Ustadz/ah {$row['nama_guru']}, jadwal {$row['mata_pelajaran']} di kelas {$row['nama_kelas']} sedang berlangsung. Mohon isi absensi!";
            echo "Mengirim peringatan ke {$row['nama_guru']}...\n";
            kirim_notifikasi_fcm($row['fcm_token'], $title, $body, ['url' => '/pages/dashboard.php']);
            
            $conn->query("UPDATE absensi_guru SET notifikasi_terkirim = 1 WHERE absensi_id = '{$absen['absensi_id']}'");
        }
    }
}


// 2. CEK JADWAL QURAN AKTIF
$sql_quran = "SELECT jq.id as jadwal_id, jq.mata_pelajaran, jq.jam_mulai, jq.jam_selesai, kq.nama_kelas, 
                     g.guru_id, g.nama as nama_guru, u.fcm_token 
              FROM jadwal_quran jq
              JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
              JOIN guru g ON g.guru_id = COALESCE(NULLIF(jq.guru_id, ''), kq.guru_id)
              JOIN users u ON g.user_id = u.id
              WHERE jq.hari = '$hari_indo' 
              AND '$waktu_sekarang' >= jq.jam_mulai 
              AND '$waktu_sekarang' <= DATE_ADD(jq.jam_selesai, INTERVAL 1 HOUR)
              AND u.fcm_token IS NOT NULL AND u.fcm_token != ''";

$result_quran = $conn->query($sql_quran);

while ($row = $result_quran->fetch_assoc()) {
    $guru_id = $row['guru_id'];
    if (empty($guru_id)) continue;
    $jadwal_id = $row['jadwal_id'];
    
    $cek_absen = $conn->query("SELECT * FROM absensi_guru 
                               WHERE guru_id = '$guru_id' AND jadwal_quran_id = '$jadwal_id' 
                               AND tanggal = '$tanggal_ini'");
                               
    if ($cek_absen->num_rows == 0) {
        $title = "📖 Peringatan Absensi Qur'an";
        $body = "Ustadz/ah {$row['nama_guru']}, jadwal {$row['mata_pelajaran']} di kelas {$row['nama_kelas']} sudah dimulai. Segera absensi kehadiran!";
        
        echo "Mengirim ke {$row['nama_guru']} (Quran)...\n";
        kirim_notifikasi_fcm($row['fcm_token'], $title, $body, ['url' => '/pages/dashboard.php']);
        
        $conn->query("INSERT INTO absensi_guru (guru_id, jadwal_quran_id, tanggal, notifikasi_terkirim) 
                      VALUES ('$guru_id', '$jadwal_id', '$tanggal_ini', 1) 
                      ON DUPLICATE KEY UPDATE notifikasi_terkirim = 1");
    } else {
        $absen = $cek_absen->fetch_assoc();
        if ($absen['status'] == 'Belum Absen' && $absen['notifikasi_terkirim'] == 0) {
            $title = "📖 Peringatan Absensi Qur'an";
            $body = "Ustadz/ah {$row['nama_guru']}, jadwal {$row['mata_pelajaran']} di kelas {$row['nama_kelas']} sedang berlangsung. Mohon absen segera!";
            echo "Mengirim peringatan ke {$row['nama_guru']}...\n";
            kirim_notifikasi_fcm($row['fcm_token'], $title, $body, ['url' => '/pages/dashboard.php']);
            
            $conn->query("UPDATE absensi_guru SET notifikasi_terkirim = 1 WHERE absensi_id = '{$absen['absensi_id']}'");
        }
    }
}


// 3. CEK JADWAL KEGIATAN AKTIF
$sql_kegiatan = "SELECT jk.kegiatan_id as jadwal_id, jk.nama_kegiatan, jk.jam_mulai, jk.jam_selesai, k.nama_kamar, 
                     g.guru_id, g.nama as nama_guru, u.fcm_token 
              FROM jadwal_kegiatan jk
              JOIN kamar k ON jk.kamar_id = k.kamar_id
              JOIN guru g ON g.guru_id = COALESCE(NULLIF(jk.guru_id, ''), k.guru_id)
              JOIN users u ON g.user_id = u.id
              WHERE jk.hari = '$hari_indo' 
              AND '$waktu_sekarang' >= jk.jam_mulai 
              AND '$waktu_sekarang' <= DATE_ADD(jk.jam_selesai, INTERVAL 1 HOUR)
              AND u.fcm_token IS NOT NULL AND u.fcm_token != ''";

$result_kegiatan = $conn->query($sql_kegiatan);

while ($row = $result_kegiatan->fetch_assoc()) {
    $guru_id = $row['guru_id'];
    if (empty($guru_id)) continue;
    $jadwal_id = $row['jadwal_id'];
    
    $cek_absen = $conn->query("SELECT * FROM absensi_guru 
                               WHERE guru_id = '$guru_id' AND kegiatan_id = '$jadwal_id' 
                               AND tanggal = '$tanggal_ini'");
                               
    if ($cek_absen->num_rows == 0) {
        $title = "🕌 Peringatan Kegiatan";
        $body = "Ustadz/ah {$row['nama_guru']}, jadwal {$row['nama_kegiatan']} di {$row['nama_kamar']} sudah dimulai. Segera absensi kehadiran!";
        
        echo "Mengirim ke {$row['nama_guru']} (Kegiatan)...\n";
        kirim_notifikasi_fcm($row['fcm_token'], $title, $body, ['url' => '/pages/dashboard.php']);
        
        $conn->query("INSERT INTO absensi_guru (guru_id, kegiatan_id, tanggal, notifikasi_terkirim) 
                      VALUES ('$guru_id', '$jadwal_id', '$tanggal_ini', 1) 
                      ON DUPLICATE KEY UPDATE notifikasi_terkirim = 1");
    } else {
        $absen = $cek_absen->fetch_assoc();
        if ($absen['status'] == 'Belum Absen' && $absen['notifikasi_terkirim'] == 0) {
            $title = "🕌 Peringatan Kegiatan";
            $body = "Ustadz/ah {$row['nama_guru']}, jadwal {$row['nama_kegiatan']} di {$row['nama_kamar']} sedang berlangsung. Mohon absen segera!";
            echo "Mengirim peringatan ke {$row['nama_guru']}...\n";
            kirim_notifikasi_fcm($row['fcm_token'], $title, $body, ['url' => '/pages/dashboard.php']);
            
            $conn->query("UPDATE absensi_guru SET notifikasi_terkirim = 1 WHERE absensi_id = '{$absen['absensi_id']}'");
        }
    }
}

echo "Pengecekan selesai.\n";
?>
