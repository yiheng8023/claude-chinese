@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ====================================================================
    echo   [提示] Claude 4.x 还原需要恢复 claude.exe 与 ion-dist.asar 出厂备份
    echo   若稍后提示目录写权限不足，请关闭后右键本脚本选择【以管理员身份运行】！
    echo ====================================================================
    echo.
)

node cli.js restore
echo.
pause
