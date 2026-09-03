@echo off
chcp 65001 >nul 2>&1
echo.
echo ====================================================
echo   Claude 桌面端中文汉化工具包一键安装器
echo   (Client Host UI Localization)
echo ====================================================
echo.
cd /d "%~dp0"

node cli.js install
echo.
pause
