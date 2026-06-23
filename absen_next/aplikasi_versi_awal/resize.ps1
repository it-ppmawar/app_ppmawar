Add-Type -AssemblyName System.Drawing

function Resize-ImagePad {
    param(
        [System.Drawing.Image]$Img,
        [int]$Size
    )
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Fill with transparent background
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Calculate scale to preserve aspect ratio
    $ratioX = $Size / $Img.Width
    $ratioY = $Size / $Img.Height
    $ratio = if ($ratioX -lt $ratioY) { $ratioX } else { $ratioY }
    
    $newWidth = [int]($Img.Width * $ratio)
    $newHeight = [int]($Img.Height * $ratio)
    
    $posX = ($Size - $newWidth) / 2
    $posY = ($Size - $newHeight) / 2
    
    $g.DrawImage($Img, $posX, $posY, $newWidth, $newHeight)
    $g.Dispose()
    return $bmp
}

$imagePath = "$PSScriptRoot\public\logo.png"
if (Test-Path $imagePath) {
    $img = [System.Drawing.Image]::FromFile($imagePath)
    
    # 192x192
    $bmp192 = Resize-ImagePad -Img $img -Size 192
    $bmp192.Save("$PSScriptRoot\public\icon-192.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp192.Dispose()

    # 512x512
    $bmp512 = Resize-ImagePad -Img $img -Size 512
    $bmp512.Save("$PSScriptRoot\public\icon-512.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp512.Dispose()

    $img.Dispose()
    
    # Update Next.js app icon
    Copy-Item -Path "$PSScriptRoot\public\icon-192.png" -Destination "$PSScriptRoot\src\app\icon.png" -Force
    if (Test-Path "$PSScriptRoot\public\favicon.ico") {
        Remove-Item "$PSScriptRoot\public\favicon.ico" -Force
    }
    
    Write-Host "Icons generated with proper proportions!"
} else {
    Write-Host "logo.png not found!"
}
