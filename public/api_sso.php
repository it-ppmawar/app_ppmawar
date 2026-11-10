<?php
/**
 * =========================================================================
 * API SSO QUIZB — LOGIN OTOMATIS SANTRI DARI PPMAWAR
 * =========================================================================
 * File ini memvalidasi token HMAC dari PPMAWAR, mengautentikasi sesi santri,
 * dan mengarahkannya langsung ke soal ujian tanpa perlu login manual.
 * =========================================================================
 */

$SECRET_KEY = 'ppmawar-quizb-2026-secret';

$nis = trim($_GET['nis'] ?? '');
$nama = trim($_GET['nama'] ?? '');
$kelas = trim($_GET['kelas'] ?? '');
$ts = (int)($_GET['ts'] ?? 0);
$sig = trim($_GET['sig'] ?? '');
$target = trim($_GET['target'] ?? '#/quizzes');

if (empty($nama) || empty($sig) || empty($ts)) {
    die("Akses Tidak Sah: Parameter SSO tidak lengkap.");
}

// Cek validitas waktu (maksimal 10 menit selisih)
if (abs(time() - $ts) > 600) {
    die("Akses Kedaluwarsa: Token SSO telah habis masa berlakunya. Silakan buka kembali dari aplikasi PPMAWAR.");
}

// Validasi Signature HMAC-SHA256
$dataToSign = "{$nis}|{$nama}|{$ts}";
$expectedSig = hash_hmac('sha256', $dataToSign, $SECRET_KEY);

if (!hash_equals($expectedSig, $sig)) {
    die("Akses Ditolak: Tanda tangan digital SSO tidak valid.");
}

// Koneksi Database Mandiri / Auto-Detect
$dbHost = 'localhost';
$dbName = 'quic1934_upgrade';
$dbUser = 'quic1934_zenhkm';
$dbPass = '03Maret1990';

$configPaths = [
    __DIR__ . '/config/db.php',
    __DIR__ . '/../config/db.php',
    __DIR__ . '/up.quizb.my.id/config/db.php',
];

foreach ($configPaths as $cfgFile) {
    if (file_exists($cfgFile)) {
        $content = file_get_contents($cfgFile);
        if (preg_match("/['\"]?DB_HOST['\"]?\s*,\s*['\"]([^'\"]+)['\"]/i", $content, $m)) $dbHost = $m[1];
        if (preg_match("/['\"]?DB_NAME['\"]?\s*,\s*['\"]([^'\"]+)['\"]/i", $content, $m)) $dbName = $m[1];
        if (preg_match("/['\"]?DB_USER['\"]?\s*,\s*['\"]([^'\"]+)['\"]/i", $content, $m)) $dbUser = $m[1];
        if (preg_match("/['\"]?DB_PASS(?:WORD)?['\"]?\s*,\s*['\"]([^'\"]+)['\"]/i", $content, $m)) $dbPass = $m[1];
        break;
    }
}

try {
    $db = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Exception $e) {
    die("Gagal terhubung ke database QuizB: " . $e->getMessage());
}

// Cari atau buat akun santri di database QuizB
$emailSantri = (!empty($nis) ? $nis : preg_replace('/[^a-zA-Z0-9]/', '', strtolower($nama))) . '@santri.ppmawar.or.id';

$stmt = $db->prepare("SELECT id, name, role FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$emailSantri]);
$user = $stmt->fetch();

if (!$user) {
    // Buat akun baru otomatis untuk santri
    $randomPass = bin2hex(random_bytes(16));
    $passHash = password_hash($randomPass, PASSWORD_BCRYPT);
    $ins = $db->prepare("INSERT INTO users (name, email, password_hash, role, is_active, created_at) VALUES (?, ?, ?, 'user', 1, NOW())");
    $ins->execute([$nama, $emailSantri, $passHash]);
    $userId = (int)$db->lastInsertId();
    $user = ['id' => $userId, 'name' => $nama, 'role' => 'user'];
}

// Inisialisasi Sesi QuizB (QUIZB_SESSION)
if (session_status() === PHP_SESSION_NONE) {
    session_name('QUIZB_SESSION');
    session_start();
}

$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['user_name'] = $user['name'];
$_SESSION['user_role'] = $user['role'];

// Pasang cookie nama pemain untuk mode ujian anonim jika diperlukan
setcookie('quizb_player_name', $nama, time() + (86400 * 30), '/');

// Redirect langsung ke target soal ujian di QuizB
$cleanTarget = ltrim($target, '/');
header("Location: https://quizb.my.id/{$cleanTarget}");
exit;
