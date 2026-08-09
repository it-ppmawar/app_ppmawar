<?php
/**
 * unzip.php - Script Otomatis Extract Deploy ZIP cPanel
 * PP MAWAR Application Deployment
 */

// Key rahasia untuk keamanan (bisa disesuaikan)
$SECRET_KEY = "ppmawar_deploy_2026";

$key = $_GET['key'] ?? $_POST['key'] ?? '';
if ($key !== $SECRET_KEY) {
    http_response_code(403);
    echo "403 Forbidden: Invalid Security Key";
    exit;
}

$targetDir = __DIR__;
// Jika unzip.php berada di folder public, extract ke parent directory (root app)
if (basename($targetDir) === 'public') {
    $targetDir = dirname($targetDir);
}

$zipFile = $targetDir . '/deploy.zip';
if (!file_exists($zipFile)) {
    $zipFile = __DIR__ . '/deploy.zip';
}

if (!file_exists($zipFile)) {
    http_response_code(404);
    echo "404 Not Found: deploy.zip file does not exist at " . $zipFile;
    exit;
}

$zip = new ZipArchive();
if ($zip->open($zipFile) === TRUE) {
    $zip->extractTo($targetDir);
    $zip->close();
    @unlink($zipFile);

    // Touch restart file for cPanel Phusion Passenger / Node.js
    $restartFile = $targetDir . '/tmp/restart.txt';
    if (!is_dir(dirname($restartFile))) {
        @mkdir(dirname($restartFile), 0755, true);
    }
    @file_put_contents($restartFile, date('Y-m-d H:i:s'));

    echo "SUCCESS: Extraction completed and Node.js app restarted at " . date('Y-m-d H:i:s');
} else {
    http_response_code(500);
    echo "ERROR: Failed to open deploy.zip";
}
