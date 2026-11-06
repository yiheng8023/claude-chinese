@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"
node cli.js launch
set "LAUNCH_EXIT=%errorlevel%"
if not "%LAUNCH_EXIT%"=="0" pause
exit /b %LAUNCH_EXIT%
