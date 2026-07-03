Add-Type -Assembly 'System.IO.Compression.FileSystem'

$source = 'd:\koding\app_absensi_online_ppma\absen_next'
$dest   = 'd:\koding\app_absensi_online_ppma\absen_next_cpanel_updated.zip'

if (Test-Path $dest) { Remove-Item $dest -Force }

$zip = [System.IO.Compression.ZipFile]::Open($dest, 'Create')

$includes = @('.next', 'public', 'package.json', 'package-lock.json', 'next.config.ts', 'server.js')

foreach ($item in $includes) {
    $fullPath = Join-Path $source $item
    if (Test-Path $fullPath -PathType Container) {
        $files = Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue
        $count = 0
        foreach ($file in $files) {
            try {
                $entryName = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName) | Out-Null
                $count++
            } catch {
                # skip files that can't be read (symlinks/junctions)
            }
        }
        Write-Host "Added folder: $item ($count files)"
    } elseif (Test-Path $fullPath -PathType Leaf) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fullPath, $item) | Out-Null
        Write-Host "Added file: $item"
    } else {
        Write-Host "Skipped (not found): $item"
    }
}

$zip.Dispose()
$size = [math]::Round((Get-Item $dest).Length / 1MB, 2)
Write-Host ""
Write-Host "=== ZIP SELESAI ===" 
Write-Host "File : $dest"
Write-Host "Size : $size MB"
