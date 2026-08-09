<?php
/**
 * unzip.php - Script Otomatis Extract Deploy ZIP cPanel
 * PP MAWAR Application Deployment
 */

// Key rahasia untuk keamanan
$SECRET_KEY = "ppmawar_deploy_2026";

$key = $_GET['key'] ?? $_POST['key'] ?? '';
if ($key !== $SECRET_KEY) {
    http_response_code(403);
    echo "403 Forbidden: Invalid Security Key";
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$targetDir = __DIR__;
if (basename($targetDir) === 'public') {
    $targetDir = dirname($targetDir);
}

echo "=== PP MAWAR DEPLOY DIAGNOSTICS ===\n";
echo "Timestamp: " . date('Y-m-d H:i:s') . "\n";
echo "Target Dir: " . $targetDir . "\n";

$zipFile = $targetDir . '/deploy.zip';
if (!file_exists($zipFile)) {
    $zipFile = __DIR__ . '/deploy.zip';
}

if (!file_exists($zipFile)) {
    echo "ERROR: deploy.zip not found at " . $zipFile . "\n";
    echo "Files in targetDir:\n";
    print_r(scandir($targetDir));
    exit;
}

echo "Found deploy.zip (" . round(filesize($zipFile) / 1024 / 1024, 2) . " MB)\n";

$zip = new ZipArchive();
if ($zip->open($zipFile) === TRUE) {
    // Backup .htaccess before extraction if exists
    $htaccessPath = $targetDir . '/.htaccess';
    $htaccessBackup = null;
    if (file_exists($htaccessPath)) {
        $htaccessBackup = file_get_contents($htaccessPath);
        echo "Backed up existing .htaccess (" . strlen($htaccessBackup) . " bytes)\n";
    }

    echo "Extracting files to " . $targetDir . "...\n";
    $zip->extractTo($targetDir);
    $numFiles = $zip->numFiles;
    $zip->close();
    @unlink($zipFile);
    echo "Extracted " . $numFiles . " items from ZIP successfully.\n";

    // Restore .htaccess if it was accidentally overwritten or missing
    if ($htaccessBackup !== null && (!file_exists($htaccessPath) || filesize($htaccessPath) === 0)) {
        file_put_contents($htaccessPath, $htaccessBackup);
        echo "Restored .htaccess backup.\n";
    }

    // Ensure proper permissions on extracted root files
    @chmod($targetDir, 0755);
    if (file_exists($htaccessPath)) {
        @chmod($htaccessPath, 0644);
        echo ".htaccess status: EXISTS (" . filesize($htaccessPath) . " bytes)\n";
    } else {
        echo ".htaccess status: MISSING! (This may cause 403 Forbidden on LiteSpeed/Passenger)\n";
    }

    if (file_exists($targetDir . '/server.js')) {
        @chmod($targetDir . '/server.js', 0644);
        echo "server.js status: EXISTS\n";
    } else {
        echo "server.js status: MISSING!\n";
    }

    // Touch restart file for cPanel Phusion Passenger / Node.js
    $restartFile = $targetDir . '/tmp/restart.txt';
    if (!is_dir(dirname($restartFile))) {
        @mkdir(dirname($restartFile), 0755, true);
    }
    @file_put_contents($restartFile, date('Y-m-d H:i:s'));
    echo "Restart file touched at " . $restartFile . "\n";

    echo "\n=== DEPLOYMENT SUCCESSFUL ===\n";
} else {
    echo "ERROR: Failed to open deploy.zip\n";
}


