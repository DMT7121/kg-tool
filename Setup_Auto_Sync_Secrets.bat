@echo off
title Cau Hinh Bi Mat Cloudflare - Hikvision Auto Sync
echo ==========================================================
echo   KINGS GRILL - CAU HINH BI MAT CLOUDFLARE WORKER
echo ==========================================================
echo.
echo [*] Vui long nhap cac thong tin de he thong tu dong chay 00:15 hang ngay.
echo.

set /p HIK_URL="1. Nhap URL ket noi may cham cong (vi du: http://kingsgrill.ddns.net:8000): "
set /p HIK_PASS="2. Nhap Mat khau cua may cham cong (admin): "

echo.
echo [*] Dang cau hinh URL ket noi len Cloudflare...
echo %HIK_URL% | npx wrangler secret put HIKVISION_TUNNEL_URL --name kingsgrill-hikvision-sync

echo.
echo [*] Dang cau hinh Mat khau len Cloudflare...
echo %HIK_PASS% | npx wrangler secret put HIKVISION_PASSWORD --name kingsgrill-hikvision-sync

echo.
echo [*] Dang cau hinh Tai khoan mac dinh (admin) len Cloudflare...
echo admin | npx wrangler secret put HIKVISION_USERNAME --name kingsgrill-hikvision-sync

echo.
echo ==========================================================
echo   CAU HINH HOAN TAT THAY DOI!
echo   Worker se tu dong dong bo hang ngay luc 00:15 sáng.
echo ==========================================================
echo.
pause
