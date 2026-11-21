@echo off
chcp 65001 >nul
echo ====================================================
echo   KG STUDIO v3.0 - GOOGLE STITCH UI BUILD ^& DEPLOY
echo ====================================================
if not exist "F:\kg-tool" (
    if exist "G:\01_KingsGrill_Core_Platform\kg-tool" (
        echo [1/4] Dang anh xa F: -^> G:\01_KingsGrill_Core_Platform ...
        subst F: "G:\01_KingsGrill_Core_Platform"
    )
)
cd /d "G:\01_KingsGrill_Core_Platform\kg-tool"
powershell -NoProfile -ExecutionPolicy Bypass -File "G:\01_KingsGrill_Core_Platform\kg-tool\deploy-now.ps1"
pause
