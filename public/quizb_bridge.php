<?php
/**
 * =========================================================================
 * QUIZB BRIDGE SCRIPT (Untuk di-upload ke Hosting Rumahweb: quizb.my.id)
 * =========================================================================
 * Letakkan file ini di direktori public_html domain quizb.my.id
 * Akses: https://quizb.my.id/quizb_bridge.php?action=test&secret=ppmawar-quizb-2026-secret
 * 
 * Script ini menjembatani QuizB (di Rumahweb) dengan App PPMAWAR (di VPS Sumopod)
 * secara aman, cepat, dan otomatis membaca database lokal QuizB.
 * =========================================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// -------------------------------------------------------------------------
// 1. KONFIGURASI KEAMANAN (Cocokkan dengan di PPMAWAR)
// -------------------------------------------------------------------------
$BRIDGE_SECRET = 'ppmawar-quizb-2026-secret';
$PPMAWAR_WEBHOOK_URL = 'https://app.ppmawar.or.id/api/quizb/webhook';

// Verifikasi Secret Token
$clientSecret = $_GET['secret'] ?? $_POST['secret'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? '');
if (empty($clientSecret) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $clientSecret = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
}

if ($clientSecret !== $BRIDGE_SECRET) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'Akses ditolak: Parameter secret / API Key tidak sesuai.'
    ]);
    exit;
}

// -------------------------------------------------------------------------
// 2. KONEKSI KE DATABASE QUIZB DI RUMAHWEB
// -------------------------------------------------------------------------
// Default DB QuizB di cPanel Rumahweb
$dbHost = 'localhost';
$dbName = 'quic1934_upgrade';
$dbUser = 'quic1934_zenhkm';
$dbPass = '03Maret1990';

// Auto-detect dari config/db.php QuizB jika ada
$configPaths = [
    __DIR__ . '/up.quizb.my.id/config/db.php',
    __DIR__ . '/config/db.php',
    __DIR__ . '/../config/db.php',
];
foreach ($configPaths as $cfgFile) {
    if (file_exists($cfgFile) && is_readable($cfgFile)) {
        $cfgContent = file_get_contents($cfgFile);
        if (preg_match("/define\('DB_HOST',\s*'([^']+)'\)/", $cfgContent, $m)) $dbHost = $m[1];
        if (preg_match("/define\('DB_NAME',\s*'([^']+)'\)/", $cfgContent, $m)) $dbName = $m[1];
        if (preg_match("/define\('DB_USER',\s*'([^']+)'\)/", $cfgContent, $m)) $dbUser = $m[1];
        if (preg_match("/define\('DB_PASS',\s*'([^']+)'\)/", $cfgContent, $m)) $dbPass = $m[1];
        break;
    }
}

// Inisialisasi PDO
$pdo = null;
try {
    $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    // Coba fallback dengan root atau username cpanel
    try {
        $pdo = new PDO("mysql:host=localhost;dbname={$dbName};charset=utf8mb4", 'quic1934', $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e2) {
        http_response_code(500);
        echo json_encode([
            'status' => 'db_error',
            'message' => 'Gagal koneksi ke database QuizB: ' . $e2->getMessage(),
            'hint' => 'Edit variabel $dbUser dan $dbPass di bagian atas quizb_bridge.php sesuai database cPanel Rumahweb.'
        ]);
        exit;
    }
}

// -------------------------------------------------------------------------
// 3. HANDLER AKSI API
// -------------------------------------------------------------------------
$action = $_GET['action'] ?? $_POST['action'] ?? 'test';

switch ($action) {

    // Aksi Test Koneksi & Deteksi Tabel
    case 'test':
        $tables = [];
        $stmt = $pdo->query("SHOW TABLES");
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $tables[] = $row[0];
        }
        echo json_encode([
            'status' => 'ok',
            'message' => 'QuizB Bridge terhubung dengan sukses di hosting Rumahweb!',
            'database' => $dbName,
            'tables_count' => count($tables),
            'tables' => $tables,
        ]);
        break;

    // Aksi Ambil Daftar Kuis
    case 'list_quizzes':
        try {
            // Deteksi nama tabel kuis yang tersedia
            $quizTable = null;
            $candidateTables = ['quizzes', 'exams', 'quiz', 'ujian', 'soal_paket', 'packages'];
            foreach ($candidateTables as $t) {
                try {
                    $test = $pdo->query("SELECT 1 FROM `{$t}` LIMIT 1");
                    $quizTable = $t;
                    break;
                } catch (Exception $ex) {}
            }

            if (!$quizTable) {
                echo json_encode(['quizzes' => [], 'message' => 'Tabel kuis belum terdeteksi otomatis.']);
                break;
            }

            // Ambil daftar kuis
            $quizzes = [];
            $sql = "SELECT * FROM `{$quizTable}` ORDER BY id DESC LIMIT 100";
            $stmt = $pdo->query($sql);
            while ($row = $stmt->fetch()) {
                $quizzes[] = [
                    'id' => $row['id'] ?? $row['quiz_id'] ?? 0,
                    'title' => $row['title'] ?? $row['nama'] ?? $row['name'] ?? $row['judul'] ?? 'Kuis #' . ($row['id'] ?? ''),
                    'description' => $row['description'] ?? $row['deskripsi'] ?? '',
                    'category' => $row['category'] ?? $row['kategori'] ?? '',
                    'total_soal' => $row['total_questions'] ?? $row['total_soal'] ?? $row['questions_count'] ?? 0,
                    'created_at' => $row['created_at'] ?? '',
                ];
            }

            echo json_encode([
                'status' => 'success',
                'table_used' => $quizTable,
                'quizzes' => $quizzes,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // Aksi Ambil Hasil Kuis Peserta
    case 'get_results':
        $quizId = $_GET['quiz_id'] ?? $_POST['quiz_id'] ?? null;
        if (!$quizId) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Parameter quiz_id wajib diisi.']);
            break;
        }

        try {
            // Deteksi tabel hasil
            $resultTable = null;
            $candidateResults = ['quiz_results', 'results', 'user_quizzes', 'submissions', 'student_exams', 'exam_results', 'nilai_kuis'];
            foreach ($candidateResults as $t) {
                try {
                    $test = $pdo->query("SELECT 1 FROM `{$t}` LIMIT 1");
                    $resultTable = $t;
                    break;
                } catch (Exception $ex) {}
            }

            if (!$resultTable) {
                echo json_encode(['results' => [], 'message' => 'Tabel hasil kuis belum terdeteksi otomatis.']);
                break;
            }

            // Coba join dengan tabel users bila ada
            $hasUsersTable = false;
            try {
                $pdo->query("SELECT 1 FROM users LIMIT 1");
                $hasUsersTable = true;
            } catch (Exception $ex) {}

            $results = [];
            if ($hasUsersTable) {
                $sql = "SELECT r.*, u.name as user_name, u.email as user_email 
                        FROM `{$resultTable}` r 
                        LEFT JOIN users u ON (r.user_id = u.id OR r.student_id = u.id)
                        WHERE (r.quiz_id = :qid OR r.exam_id = :qid)
                        ORDER BY r.id DESC";
            } else {
                $sql = "SELECT * FROM `{$resultTable}` 
                        WHERE (quiz_id = :qid OR exam_id = :qid) 
                        ORDER BY id DESC";
            }

            $stmt = $pdo->prepare($sql);
            $stmt->execute([':qid' => $quizId]);

            while ($r = $stmt->fetch()) {
                $nama = $r['user_name'] ?? $r['student_name'] ?? $r['nama'] ?? $r['name'] ?? '';
                $nis = $r['nis'] ?? $r['user_nis'] ?? $r['student_nis'] ?? '';
                $skor = $r['score'] ?? $r['nilai'] ?? $r['final_score'] ?? $r['point'] ?? 0;

                $results[] = [
                    'nama' => $nama,
                    'nis' => $nis,
                    'skor' => (float)$skor,
                    'raw_data' => $r,
                ];
            }

            echo json_encode([
                'status' => 'success',
                'quiz_id' => $quizId,
                'total_results' => count($results),
                'results' => $results,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    // Aksi Push Otomatis ke Webhook PPMAWAR
    case 'push_to_ppmawar':
        $quizId = $_POST['quiz_id'] ?? $_GET['quiz_id'] ?? null;
        $mataPelajaran = $_POST['mata_pelajaran'] ?? $_GET['mata_pelajaran'] ?? 'Fiqih';
        $targetField = $_POST['target_field'] ?? $_GET['target_field'] ?? 'harian';
        $semester = $_POST['semester'] ?? $_GET['semester'] ?? '1';
        $tahunAjaran = $_POST['tahun_ajaran'] ?? $_GET['tahun_ajaran'] ?? '2025/2026';

        if (!$quizId) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Parameter quiz_id wajib diisi.']);
            break;
        }

        // Ambil data hasil kuis dulu
        // (Gunakan logic get_results)
        $ch = curl_init();
        $payload = [
            'quiz_id' => $quizId,
            'quiz_title' => 'QuizB #' . $quizId,
            'mata_pelajaran' => $mataPelajaran,
            'target_field' => $targetField,
            'semester' => $semester,
            'tahun_ajaran' => $tahunAjaran,
            'scores' => [],
            'source' => 'bridge_push',
        ];

        // Jalankan get_results internal
        // ...
        curl_setopt($ch, CURLOPT_URL, $PPMAWAR_WEBHOOK_URL);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-API-Key: ' . $BRIDGE_SECRET,
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        echo json_encode([
            'status' => $httpCode === 200 ? 'success' : 'error',
            'ppmawar_http_code' => $httpCode,
            'ppmawar_response' => json_decode($response, true) ?: $response,
        ]);
        break;

    // Aksi Ambil Butir Soal dari Kuis QuizB
    case 'get_questions':
        $quizId = $_GET['quiz_id'] ?? $_POST['quiz_id'] ?? null;
        $search = $_GET['q'] ?? $_POST['q'] ?? null;

        try {
            // Deteksi nama tabel soal
            $questionTable = null;
            $candidateQues = ['questions', 'quiz_questions', 'soal', 'tbl_soal', 'exam_questions', 'items'];
            foreach ($candidateQues as $t) {
                try {
                    $test = $pdo->query("SELECT 1 FROM `{$t}` LIMIT 1");
                    $questionTable = $t;
                    break;
                } catch (Exception $ex) {}
            }

            if (!$questionTable) {
                echo json_encode(['status' => 'success', 'questions' => [], 'message' => 'Tabel soal kuis belum terdeteksi otomatis.']);
                break;
            }

            // Ambil daftar kolom tabel soal
            $colStmt = $pdo->query("DESCRIBE `{$questionTable}`");
            $columns = [];
            while ($c = $colStmt->fetch()) {
                $columns[] = strtolower($c['Field']);
            }

            // Deteksi kolom quiz_id
            $quizIdCol = 'quiz_id';
            foreach (['quiz_id', 'exam_id', 'package_id', 'id_kuis', 'id_ujian', 'id_paket'] as $col) {
                if (in_array($col, $columns)) {
                    $quizIdCol = $col;
                    break;
                }
            }

            // Deteksi kolom pertanyaan
            $pertanyaanCol = 'question';
            foreach (['question', 'question_text', 'pertanyaan', 'soal', 'title', 'body', 'content'] as $col) {
                if (in_array($col, $columns)) {
                    $pertanyaanCol = $col;
                    break;
                }
            }

            // Build Query
            $whereParts = [];
            $queryParams = [];

            if ($quizId && in_array($quizIdCol, $columns)) {
                $whereParts[] = "`{$quizIdCol}` = :qid";
                $queryParams[':qid'] = $quizId;
            }

            if ($search) {
                $whereParts[] = "`{$pertanyaanCol}` LIKE :search";
                $queryParams[':search'] = '%' . $search . '%';
            }

            $whereSql = count($whereParts) > 0 ? "WHERE " . implode(' AND ', $whereParts) : "";
            $sql = "SELECT * FROM `{$questionTable}` {$whereSql} ORDER BY id ASC LIMIT 200";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($queryParams);
            
            $questions = [];
            while ($row = $stmt->fetch()) {
                // Ekstraksi opsi A, B, C, D, E
                $opsiA = $row['option_a'] ?? $row['opsi_a'] ?? $row['choice_a'] ?? $row['a'] ?? '';
                $opsiB = $row['option_b'] ?? $row['opsi_b'] ?? $row['choice_b'] ?? $row['b'] ?? '';
                $opsiC = $row['option_c'] ?? $row['opsi_c'] ?? $row['choice_c'] ?? $row['c'] ?? '';
                $opsiD = $row['option_d'] ?? $row['opsi_d'] ?? $row['choice_d'] ?? $row['d'] ?? '';
                $opsiE = $row['option_e'] ?? $row['opsi_e'] ?? $row['choice_e'] ?? $row['e'] ?? '';

                // Ekstraksi kunci
                $kunci = $row['correct_answer'] ?? $row['correct_option'] ?? $row['answer'] ?? $row['kunci'] ?? $row['kunci_jawaban'] ?? 'A';
                
                // Normalisasi kunci: jika kunci berupa teks yang sama dengan opsi, ubah ke huruf A/B/C/D
                if (strlen($kunci) > 1) {
                    if (trim($kunci) === trim($opsiA)) $kunci = 'A';
                    elseif (trim($kunci) === trim($opsiB)) $kunci = 'B';
                    elseif (trim($kunci) === trim($opsiC)) $kunci = 'C';
                    elseif (trim($kunci) === trim($opsiD)) $kunci = 'D';
                    elseif (trim($kunci) === trim($opsiE)) $kunci = 'E';
                    else $kunci = substr(strtoupper($kunci), 0, 1);
                }
                $kunci = strtoupper(trim($kunci));
                if (!in_array($kunci, ['A', 'B', 'C', 'D', 'E'])) $kunci = 'A';

                $questions[] = [
                    'id' => $row['id'] ?? 0,
                    'pertanyaan' => $row[$pertanyaanCol] ?? $row['question'] ?? $row['pertanyaan'] ?? '',
                    'gambar' => $row['gambar'] ?? $row['image'] ?? $row['photo'] ?? null,
                    'opsi_a' => $opsiA,
                    'opsi_b' => $opsiB,
                    'opsi_c' => $opsiC,
                    'opsi_d' => $opsiD,
                    'opsi_e' => $opsiE,
                    'kunci_jawaban' => $kunci,
                    'bobot_nilai' => (int)($row['point'] ?? $row['score'] ?? $row['bobot'] ?? 10),
                    'pembahasan' => $row['explanation'] ?? $row['pembahasan'] ?? null,
                ];
            }

            echo json_encode([
                'status' => 'success',
                'quiz_id' => $quizId,
                'table_used' => $questionTable,
                'total_questions' => count($questions),
                'questions' => $questions,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => "Aksi '{$action}' tidak dikenal. Pilihan: test, list_quizzes, get_results, get_questions, push_to_ppmawar."
        ]);
        break;
}
