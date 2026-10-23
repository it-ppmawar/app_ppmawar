@echo off
:: Cek apakah dijalankan sebagai Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Meminta izin Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ====================================================
echo   MEMPERBAIKI MASALAH WINDOWS MOBILE HOTSPOT
echo ====================================================
echo.
echo 1. Menghapus konfigurasi PreferredPublicInterface yang tertinggal...
reg delete "HKLM\SYSTEM\CurrentControlSet\Services\icssvc\Settings" /v "PreferredPublicInterface" /f

echo 2. Merestart layanan Mobile Hotspot (icssvc)...
net stop icssvc >nul 2>&1
net start icssvc >nul 2>&1

echo.
echo ====================================================
echo Perbaikan berhasil dilakukan!
echo Silakan tutup jendela Settings lalu buka kembali:
echo Settings -> Network & internet -> Mobile hotspot
echo ====================================================
pause
