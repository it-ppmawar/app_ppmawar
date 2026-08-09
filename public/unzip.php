<?php
/**
 * unzip.php - Script Otomatis Extract Deploy ZIP cPanel
 * PP MAWAR Application Deployment - Auto htaccess restore
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
    // Backup .htaccess and .env before extraction if exists
    $htaccessPath = $targetDir . '/.htaccess';
    $envPath = $targetDir . '/.env';
    $htaccessBackup = null;
    $envBackup = null;

    if (file_exists($htaccessPath)) {
        $htaccessBackup = file_get_contents($htaccessPath);
        echo "Backed up existing .htaccess (" . strlen($htaccessBackup) . " bytes)\n";
    }
    if (file_exists($envPath)) {
        $envBackup = file_get_contents($envPath);
        echo "Backed up existing production .env (" . strlen($envBackup) . " bytes)\n";
    }

    echo "Extracting files to " . $targetDir . "...\n";
    $zip->extractTo($targetDir);
    $numFiles = $zip->numFiles;
    $zip->close();
    @unlink($zipFile);
    echo "Extracted " . $numFiles . " items from ZIP successfully.\n";

    // Restore .env if it existed
    if ($envBackup !== null) {
        file_put_contents($envPath, $envBackup);
        echo "Restored production .env credentials.\n";
    }

    // Restore .htaccess if it was accidentally overwritten or missing
    if ($htaccessBackup !== null && (!file_exists($htaccessPath) || filesize($htaccessPath) === 0)) {
        file_put_contents($htaccessPath, $htaccessBackup);
        echo "Restored .htaccess backup.\n";
    }

    // If .htaccess is still missing or empty, create default LiteSpeed Passenger config
    if (!file_exists($htaccessPath) || filesize($htaccessPath) === 0) {
        $defaultHtaccess = "# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN\n" .
                           "DirectoryIndex disabled\n" .
                           "PassengerAppType node\n" .
                           "PassengerStartupFile server.js\n" .
                           "PassengerAppRoot \"" . $targetDir . "\"\n" .
                           "# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END\n";
        file_put_contents($htaccessPath, $defaultHtaccess);
        echo "Auto-generated fallback .htaccess for LiteSpeed Node.js Passenger.\n";
    }

    // Ensure proper permissions on extracted root files
    @chmod($targetDir, 0755);
    if (file_exists($htaccessPath)) {
        @chmod($htaccessPath, 0644);
        echo ".htaccess status: EXISTS (" . filesize($htaccessPath) . " bytes)\n";
    } else {
        echo ".htaccess status: MISSING!\n";
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


