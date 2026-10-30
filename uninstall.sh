#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ ! -d node_modules/@electron/asar ] || [ ! -d node_modules/@formatjs/icu-messageformat-parser ]; then
  npm ci --ignore-scripts
fi

node cli.js restore

echo ""
echo "✅ 还原完成，已恢复官方英文。"
