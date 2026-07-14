<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);
echo "<pre>";

echo "=== LATEST stderr.log ===\n";
$logFile = __DIR__ . "/stderr.log";
if (file_exists($logFile)) {
    $lines = file($logFile);
    $last30 = array_slice($lines, -30);
    foreach ($last30 as $line) {
        echo htmlspecialchars($line);
    }
} else {
    echo "stderr.log not found\n";
}

echo "\n=== NEXT.JS VERSIONS ===\n";
$pkg_local = __DIR__ . "/node_modules/next/package.json";
if (file_exists($pkg_local)) {
    $data = json_decode(file_get_contents($pkg_local), true);
    echo "Local next version: " . $data["version"] . "\n";
} else {
    echo "Local next version: NOT INSTALLED\n";
}

$pkg_venv = "/home/ppmawaro/nodevenv/app.ppmawar.or.id/20/lib/node_modules/next/package.json";
if (file_exists($pkg_venv)) {
    $data = json_decode(file_get_contents($pkg_venv), true);
    echo "Venv next version:  " . $data["version"] . "\n";
} else {
    echo "Venv next version:  NOT INSTALLED\n";
}

echo "\n=== NPM LOGS IN DIRECTORY ===\n";
$files = scandir(__DIR__);
foreach ($files as $file) {
    if (strpos($file, "npm") !== false || strpos($file, "log") !== false) {
        echo "Found log file: $file (" . filesize(__DIR__ . "/" . $file) . " bytes)\n";
        if (filesize(__DIR__ . "/" . $file) > 0 && filesize(__DIR__ . "/" . $file) < 50000) {
            echo "--- Content of $file ---\n";
            echo htmlspecialchars(file_get_contents(__DIR__ . "/" . $file));
            echo "------------------------\n";
        }
    }
}
echo "</pre>";

