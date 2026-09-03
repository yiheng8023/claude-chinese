@echo off
setlocal
chcp 65001 >nul 2>&1

:: 获取脚本所在真实绝对路径
set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

:: 检测当前是否具有管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ====================================================
    echo   [提示] 正在申请管理员权限以还原 WindowsApps 官方资源...
    echo ====================================================
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -WorkingDirectory '%BASE_DIR:~0,-1%' -ArgumentList '/c \"\"%~f0\"\" admin' -Verb RunAs"
    exit /b
)

echo.
echo ====================================================
echo   Claude 桌面端中文汉化工具包一键还原器
echo ====================================================
echo.

node "%BASE_DIR%cli.js" restore
echo.
pause
exit /b
