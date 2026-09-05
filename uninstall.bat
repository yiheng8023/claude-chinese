@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

:: 自动请求管理员权限 (用于穿透 WindowsApps MSIX 目录访问控制)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 正在请求管理员权限以还原 Claude 资源...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

node cli.js restore
echo.
pause
