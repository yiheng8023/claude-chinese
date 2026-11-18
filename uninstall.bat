@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

set "CLAUDE_CN_NEED_DEPS="
if not exist "node_modules\@electron\asar\package.json" set "CLAUDE_CN_NEED_DEPS=1"
if not exist "node_modules\@formatjs\icu-messageformat-parser\package.json" set "CLAUDE_CN_NEED_DEPS=1"
if defined CLAUDE_CN_NEED_DEPS (
    call npm ci --ignore-scripts
    if errorlevel 1 (
        echo [错误] 依赖安装失败，未修改 Claude 客户端。
        pause
        exit /b 1
    )
)

node cli.js restore %*
set "RESTORE_EXIT=%errorlevel%"
echo.
pause
exit /b %RESTORE_EXIT%
