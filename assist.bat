@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"
node assist\windows\start.cjs
set "ASSIST_EXIT=%errorlevel%"
if not "%ASSIST_EXIT%"=="0" pause
exit /b %ASSIST_EXIT%
