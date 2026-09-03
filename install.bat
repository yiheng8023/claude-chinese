@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

:: 获取当前批处理所在绝对路径
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_PATH=%~f0"

:: 检测是否具有管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 正在申请管理员权限以修改 WindowsApps 资源目录...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/k cd /d \"%SCRIPT_DIR%\" && \"%SCRIPT_PATH%\" elevated' -Verb RunAs"
    exit /b
)

:: 无论从何处启动，强制锁定进入脚本所在物理目录
cd /d "%SCRIPT_DIR%"

echo ====================================================
echo   Claude 桌面端中文汉化工具包一键安装器
echo ====================================================
echo.

node "%SCRIPT_DIR%cli.js" install
echo.
pause
exit /b
