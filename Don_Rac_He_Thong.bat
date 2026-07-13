@echo off
:: Thiết lập mã hóa UTF-8 để hiển thị tiếng Việt có dấu trong Command Prompt
chcp 65001 > nul
title Công cụ Dọn rác Hệ thống tự động - Antigravity

:: Kiểm tra quyền Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo =================================================================
    echo [!] CẢNH BÁO: CẦN CHẠY BẰNG QUYỀN ADMIN (ADMINISTRATOR)
    echo.
    echo Vui lòng click chuột phải vào file này và chọn "Run as administrator"
    echo (Chạy dưới quyền quản trị viên) để dọn rác triệt để hơn.
    echo =================================================================
    echo.
    pause
    exit /b
)

echo =================================================================
echo             CÔNG CỤ DỌN RÁC HỆ THỐNG TỰ ĐỘNG (WINDOWS)
echo =================================================================
echo.
echo Các khu vực sẽ được dọn dẹp bao gồm:
echo  [1] Thư mục chứa tệp tin tạm của người dùng (User Temp)
echo  [2] Thư mục chứa tệp tin tạm của Windows (System Temp)
echo  [3] Thư mục bộ nhớ đệm hệ thống (Prefetch Cache)
echo  [4] Bản ghi sự cố ứng dụng (Crash Dumps)
echo  [5] Bộ nhớ đệm cập nhật hệ điều hành (Windows Update Cache)
echo  [6] Bản sao lưu Sapo cũ (chỉ giữ lại 5 bản gần nhất)
echo  [7] Tắt chế độ ngủ đông hệ thống (Giải phóng file hiberfil.sys)
echo  [8] Làm sạch Thùng rác (Recycle Bin)
echo.
echo Nhấn phím bất kỳ để bắt đầu dọn dẹp...
pause > nul
echo.
echo -----------------------------------------------------------------

:: 1. Dọn dẹp User Temp
echo [+] Đang dọn dẹp Thư mục Tạm người dùng (User Temp)...
del /f /s /q "%temp%\*.*" > nul 2>&1
for /d %%x in ("%temp%\*") do rmdir /s /q "%%x" > nul 2>&1

:: 2. Dọn dẹp System Temp
echo [+] Đang dọn dẹp Thư mục Tạm hệ thống (System Temp)...
del /f /s /q "%systemroot%\temp\*.*" > nul 2>&1
for /d %%x in ("%systemroot%\temp\*") do rmdir /s /q "%%x" > nul 2>&1

:: 3. Dọn dẹp Prefetch
echo [+] Đang dọn dẹp Bộ nhớ đệm Prefetch...
del /f /s /q "%systemroot%\prefetch\*.*" > nul 2>&1
for /d %%x in ("%systemroot%\prefetch\*") do rmdir /s /q "%%x" > nul 2>&1

:: 4. Dọn dẹp Crash Dumps
echo [+] Đang dọn dẹp Crash Dumps...
del /f /s /q "%localappdata%\CrashDumps\*.*" > nul 2>&1
for /d %%x in ("%localappdata%\CrashDumps\*") do rmdir /s /q "%%x" > nul 2>&1

:: 5. Dọn dẹp Windows Update Download Cache
echo [+] Đang tạm dừng dịch vụ Windows Update để xóa hàng đợi...
net stop wuauserv > nul 2>&1
net stop bits > nul 2>&1
echo [+] Đang xóa bộ nhớ đệm tải xuống Windows Update...
del /f /s /q "%systemroot%\SoftwareDistribution\Download\*.*" > nul 2>&1
for /d %%x in ("%systemroot%\SoftwareDistribution\Download\*") do rmdir /s /q "%%x" > nul 2>&1
echo [+] Đang khởi động lại dịch vụ Windows Update...
net start wuauserv > nul 2>&1
net start bits > nul 2>&1

:: 6. Dọn dẹp Sapo Backup (Chỉ giữ lại 5 file mới nhất)
echo [+] Đang dọn dẹp sao lưu Sapo cũ (chỉ giữ 5 bản gần nhất)...
powershell -NoProfile -Command "if (Test-Path '$env:LOCALAPPDATA\Sapo\Backup') { Get-ChildItem -Path '$env:LOCALAPPDATA\Sapo\Backup' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force }" > nul 2>&1

:: 7. Tắt chế độ ngủ đông hệ thống (Giải phóng hiberfil.sys)
echo [+] Đang tắt chế độ ngủ đông hệ thống (Giải phóng hiberfil.sys)...
powercfg -h off > nul 2>&1

:: 8. Làm trống Thùng rác
echo [+] Đang làm sạch Thùng rác (Recycle Bin)...
powershell -NoProfile -Command "Clear-RecycleBin -Confirm:$false -ErrorAction SilentlyContinue" > nul 2>&1

echo -----------------------------------------------------------------
echo =================================================================
echo        DỌN RÁC HOÀN TẤT! MÁY TÍNH CỦA BẠN ĐÃ SẠCH SẼ HƠN.
echo =================================================================
echo.
echo Bạn có thể đóng cửa sổ này ngay bây giờ.
echo.
pause
