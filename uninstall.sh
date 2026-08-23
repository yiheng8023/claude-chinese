#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

node cli.js restore

echo ""
echo "✅ 还原完成，已恢复官方英文。"
