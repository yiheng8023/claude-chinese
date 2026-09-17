@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: 检测是否具备系统管理员权限 (基于 Minifilter 驱动级检测，免除 Server 服务依赖)
fltmc >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 正在申请管理员权限以访问 MSIX 应用目录...
    powershell -NoProfile -Command "Start-Process -FilePath '%COMSPEC%' -ArgumentList '/c `\"%~f0`\" %*' -Verb RunAs"
    exit /b
)

node cli.js install
echo.
pause
