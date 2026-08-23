#!/bin/bash
set -e

echo ""
echo "===================================================="
echo "   Claude Desktop 桌面端自愈型中文汉化工具包"
echo "   (Claude Chinese Localization Toolkit for macOS/Linux)"
echo "===================================================="
echo ""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if pgrep -i "Claude" > /dev/null 2>&1; then
    echo "⚠️ 检测到 Claude 桌面客户端正在运行中..."
    echo "⚠️ 正在安全退出 Claude 进程以释放文件占用..."
    killall Claude > /dev/null 2>&1 || pkill -i Claude > /dev/null 2>&1 || true
    sleep 1
fi

node cli.js install

echo ""
echo "✅ 安装完成，请重新启动 Claude 桌面端。"
