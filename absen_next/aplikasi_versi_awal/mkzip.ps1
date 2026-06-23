Add-Type -Assembly 'System.IO.Compression.FileSystem'

$src  = 'D:\koding\absensi_online_ppma\absen_next'
$dest = "$src\deploy.zip"

if (Test-Path $dest) { Remove-Item $dest -Force }

$zip = [System.IO.Compression.ZipFile]::Open($dest, 'Create')

function Add-FolderToZip($folderPath, $zipStream, $rootPath, $skipPrefixes = @()) {
    Get-ChildItem $folderPath -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($rootPath.Length + 1)
        foreach ($skip in $skipPrefixes) {
            if ($rel.StartsWith($skip)) { return }
        }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipStream, $_.FullName, $rel) | Out-Null
    }
}

Write-Output "Zipping .next ..."
Add-FolderToZip "$src\.next" $zip $src @('.next\cache', '.next\dev')

Write-Output "Zipping public ..."
Add-FolderToZip "$src\public" $zip $src

Write-Output "Adding root config files ..."
@('package.json','package-lock.json','next.config.ts','server.js','postcss.config.mjs','tsconfig.json') | ForEach-Object {
    $fp = "$src\$_"
    if (Test-Path $fp) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fp, $_) | Out-Null
    }
}

$zip.Dispose()
$mb = [math]::Round((Get-Item $dest).Length / 1MB, 2)
Write-Output "SELESAI! deploy.zip = $mb MB"
