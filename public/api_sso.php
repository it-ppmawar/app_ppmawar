<?php
/**
 * =========================================================================
 * API SSO QUIZB — LOGIN OTOMATIS SANTRI DARI PPMAWAR
 * =========================================================================
 * Letakkan file ini di direktori public_html domain quizb.my.id
 * File ini memvalidasi token HMAC dari PPMAWAR, mengautentikasi sesi santri,
 * dan mengarahkannya langsung ke soal ujian tanpa perlu login manual.
 * =========================================================================
 */

if (file_exists(__DIR__ . '/up.quizb.my.id/config/db.php')) {
    require_once __DIR__ . '/up.quizb.my.id/config/db.php';
    require_once __DIR__ . '/up.quizb.my.id/includes/auth.php';
} else {
    require_once __DIR__ . '/config/db.php';
    require_once __DIR__ . '/includes/auth.php';
}

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

// Cari atau buat akun santri di database QuizB
$db = DB::getInstance();
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

// Aktifkan sesi QuizB
startSecureSession();
$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['user_name'] = $user['name'];
$_SESSION['user_role'] = $user['role'];

// Pasang cookie nama pemain untuk mode ujian anonim jika diperlukan
setcookie('quizb_player_name', $nama, time() + (86400 * 30), '/');

// Redirect langsung ke target soal ujian di QuizB
$cleanTarget = ltrim($target, '/');
header("Location: https://quizb.my.id/{$cleanTarget}");
exit;
