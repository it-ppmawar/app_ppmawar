<?php
/**
 * scripts/unzip.php
 * Secure standalone ZIP extractor for cPanel deployment.
 * Uses PHP native C-based ZipArchive to extract in <100ms without blocking Node.js.
 */
$secret = 'ppmawar_deploy_2026_secure';
if (!isset($_GET['key']) || $_GET['key'] !== $secret) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized access']);
    exit;
}

$zipFile = __DIR__ . '/deploy.zip';
if (!file_exists($zipFile)) {
    echo json_encode(['status' => 'ok', 'message' => 'deploy.zip already extracted']);
    exit;
}

if (!class_exists('ZipArchive')) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'ZipArchive class not available']);
    exit;
}

$zip = new ZipArchive();
$res = $zip->open($zipFile);
if ($res === TRUE) {
    $zip->extractTo(__DIR__);
    $zip->close();
    @unlink($zipFile);

    // Ensure tmp/restart.txt exists to trigger Phusion Passenger reload
    $tmpDir = __DIR__ . '/tmp';
    if (!is_dir($tmpDir)) {
        @mkdir($tmpDir, 0755, true);
    }
    @touch($tmpDir . '/restart.txt');

    echo json_encode(['status' => 'success', 'message' => 'deploy.zip extracted successfully and restart triggered!']);
} else {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to open ZIP archive, code: ' . $res]);
}
