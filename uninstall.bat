@echo off
chcp 65001 >nul
title Claude 汉化还原程序

net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
node cli.js restore
echo.
pause
