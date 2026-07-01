@echo off
title Cong Cham Cong Online - Hikvision Tunnel
echo ==========================================================
echo   KINGS GRILL - DICH VU CONG CHAM CONG ONLINE
echo ==========================================================
echo [*] Dang khoi dong duong truyen bao mat (Tunnel)...
echo [*] Vui long doi trong giay lat...
echo.

cd /d "F:\kg-tool"
if not exist "cloudflared.exe" (
    echo [!] Khong tim thay tap tin cloudflared.exe trong thu muc F:\kg-tool!
    pause
    exit /b
)

.\cloudflared.exe tunnel --url http://192.168.1.3
pause
