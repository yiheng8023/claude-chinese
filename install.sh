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

node cli.js install

echo ""
echo "✅ 安装完成，请重新启动 Claude 桌面端。"
