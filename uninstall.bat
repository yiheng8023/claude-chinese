@echo off
setlocal
cd /d "%~dp0"

:: 检查是否已具备管理员权限，若无则自动弹出 UAC 提权窗口
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] 正在申请管理员权限以还原 WindowsApps 资源...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dpnx0\"\"' -Verb RunAs"
    exit /b
)

node cli.js restore
echo.
pause
