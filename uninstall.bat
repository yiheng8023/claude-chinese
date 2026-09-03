@echo off
chcp 65001 >nul 2>&1

:: 检测是否具有管理员权限，若无则自动弹出 UAC 提权
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 正在申请管理员权限以还原 WindowsApps 官方资源...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo ====================================================
echo   Claude 桌面端中文汉化工具包一键还原器
echo ====================================================
echo.

node cli.js restore
echo.
pause
