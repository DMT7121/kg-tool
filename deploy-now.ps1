$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  KG STUDIO v3.0 - ENTERPRISE UI/UX BUILD & DEPLOY" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Khôi phục ánh xạ ổ F: -> G:\ nếu ổ F: bị đổi ký tự sang G:
if (-not (Test-Path "F:\kg-tool") -and (Test-Path "G:\kg-tool")) {
    Write-Host "[1/4] Dang anh xa lai o F: -> G:\ (subst F: G:\)..." -ForegroundColor Yellow
    cmd /c "subst F: G:\" | Out-Null
}

Set-Location "G:\kg-tool"

# 2. Build Webapp + Đóng gói Chrome/Edge Extension (.zip)
Write-Host "[2/4] Dang build Webapp & Extension (npm run build:extension)..." -ForegroundColor Yellow
npm run build:extension

# 3. Commit & Push lên GitHub (tự động kích hoạt CI/CD Deploy)
Write-Host "[3/4] Dang dong bo ma nguon len GitHub (origin/main)..." -ForegroundColor Yellow
git add src/index.css src/App.css src/App.tsx src/PayrollCreator.tsx src/PayrollCreator.css src/components/Shared.tsx src/components/TransferFileTool.tsx src/components/TTSPage.tsx src/components/HikvisionSync.tsx src/components/CommandPalette.tsx src/components/SlideOverDrawer.tsx public/KG-Studio-Extension-v2.5.0.zip

$status = git status --porcelain
if ($status) {
    git commit -m "feat(design-system): redesign KG Studio v3.0 Enterprise UI/UX, unified color tokens, executive KPI cards & polished workflows"
    git push origin main
    Write-Host "[4/4] Da day giao dien moi v3.0 len GitHub (origin/main) thanh cong!" -ForegroundColor Green
} else {
    Write-Host "[4/4] Khong co thay doi moi can commit. Dang kiem tra git push..." -ForegroundColor Green
    git push origin main
}

Write-Host "====================================================" -ForegroundColor Green
Write-Host "  HOAN TAT DEPLOY GIAO DIEN MOI KG STUDIO v3.0!" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
