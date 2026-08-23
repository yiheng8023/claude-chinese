@echo off
chcp 65001 >nul
title Claude 中文汉化一键安装程序

:: 检查并获取管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [提示] 正在请求管理员权限以适配 WindowsApps 目录...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo ======================================================
echo    Claude 桌面客户端自愈型中文汉化工具包 (claude-chinese)
echo ======================================================
echo.

node cli.js install

echo.
echo 按任意键退出...
pause >nul
