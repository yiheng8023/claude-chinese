@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c cd /d ""%~dp0"" && node cli.js restore && pause' -Verb RunAs"
    exit /b
)

node cli.js restore
echo.
pause
