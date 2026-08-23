@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c cd /d ""%~dp0"" && node cli.js install && pause' -Verb RunAs"
    exit /b
)

echo 🔍 正在检测 Claude 进程状态...
tasklist /FI "IMAGENAME eq Claude.exe" 2>NUL | find /I /N "Claude.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ⚠️ 检测到 Claude 桌面客户端正在运行中！
    echo ⚠️ 正在安全退出 Claude 进程以释放文件占用...
    taskkill /F /IM Claude.exe >nul 2>&1
    timeout /t 1 /nobreak >nul 2>&1
)

node cli.js install
echo.
pause
