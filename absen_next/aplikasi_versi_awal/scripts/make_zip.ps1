$source = "d:\koding\absensi_online_ppma\absen_next"
$dest = "d:\koding\absensi_online_ppma\absen_ppma_cpanel.zip"

Write-Host "Membuat ZIP production untuk cPanel..." -ForegroundColor Cyan

if (Test-Path $dest) { Remove-Item $dest -Force }

$temp = "d:\koding\absensi_online_ppma\_temp_cpanel"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

$copyItems = @("public","src","scripts","server.js","package.json","package-lock.json","tsconfig.json")

foreach ($f in @("next.config.ts","next.config.js","postcss.config.mjs","tailwind.config.ts","tailwind.config.js")) {
  if (Test-Path "$source\$f") { $copyItems += $f }
}

foreach ($item in $copyItems) {
  $src = "$source\$item"
  if (Test-Path $src) {
    $dst = "$temp\$item"
    if ((Get-Item $src).PSIsContainer) {
      Copy-Item -Path $src -Destination $dst -Recurse -Force
    } else {
      Copy-Item -Path $src -Destination $dst -Force
    }
    Write-Host "  Copied: $item" -ForegroundColor Green
  }
}

Write-Host "  Copying .next (excluding dev folder)..." -ForegroundColor Green
$nextSrc = "$source\.next"
$nextDst = "$temp\.next"
New-Item -ItemType Directory -Path $nextDst | Out-Null

Get-ChildItem -Path $nextSrc | Where-Object { $_.Name -ne "dev" } | ForEach-Object {
  if ($_.PSIsContainer) {
    Copy-Item -Path $_.FullName -Destination "$nextDst\$($_.Name)" -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    Copy-Item -Path $_.FullName -Destination "$nextDst\$($_.Name)" -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Mengompresi semua file..." -ForegroundColor Cyan
Compress-Archive -Path "$temp\*" -DestinationPath $dest -Force

Remove-Item $temp -Recurse -Force

if (Test-Path $dest) {
  $size = (Get-Item $dest).Length / 1MB
  Write-Host "ZIP berhasil dibuat!" -ForegroundColor Green
  Write-Host "Path  : $dest" -ForegroundColor White
  Write-Host "Ukuran: $([math]::Round($size,2)) MB" -ForegroundColor White
  Write-Host "Langkah selanjutnya: Upload file ZIP ini ke File Manager cPanel!" -ForegroundColor Yellow
} else {
  Write-Host "ZIP gagal dibuat." -ForegroundColor Red
}
