@echo off
chcp 65001 >nul 2>&1
echo.
echo ====================================================
echo   Claude 桌面端中文汉化工具包一键还原器
echo   (Client Host UI Restore)
echo ====================================================
echo.
cd /d "%~dp0"

node cli.js restore
echo.
pause
