@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: 自动检测管理员权限，未提权则自动请求 UAC 弹窗授权
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 正在请求系统管理员权限以访问 MSIX 应用目录...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~dpnx0\"\"' -Verb RunAs"
    exit /b
)

node cli.js restore
echo.
pause
