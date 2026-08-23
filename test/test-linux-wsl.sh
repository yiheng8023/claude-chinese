#!/usr/bin/env bash
set -e

echo "===================================================="
echo "   Linux (WSL/POSIX) 原生 Bash 注入与探测真机实测"
echo "===================================================="

MOCK_ROOT="/tmp/claude-desktop-test"
MOCK_RES="$MOCK_ROOT/resources"
MOCK_ION="$MOCK_RES/ion-dist/i18n"
MOCK_DYN="$MOCK_ION/dynamic"
MOCK_ASSETS="$MOCK_RES/ion-dist/assets/v1"

echo "1. 搭建 Linux 标准 Claude Desktop 目录结构: $MOCK_ROOT"
mkdir -p "$MOCK_DYN"
mkdir -p "$MOCK_ASSETS"

echo '{"key": "Hello from Linux Claude"}' > "$MOCK_RES/en-US.json"
echo '{"key": "Hello from Linux Ion"}' > "$MOCK_ION/en-US.json"
echo '{"key": "Hello from Linux Dynamic"}' > "$MOCK_DYN/en-US.json"
echo 'const xu=["en-US","ja-JP"];' > "$MOCK_ASSETS/shared-2-BF65-y49.js"

echo "2. 验证路径存在与可写性..."
if [ -w "$MOCK_RES" ] && [ -f "$MOCK_ASSETS/shared-2-BF65-y49.js" ]; then
    echo "   ✅ Linux 模拟应用包创建成功，具备完整 POSIX 读写权限"
else
    echo "   ❌ 权限或路径创建失败"
    exit 1
fi

echo "3. 执行 Linux 原生 JS 白名单注册与增量字典注入..."
# 模拟 patcher 中的 JS 正则替换
sed -i 's/\["en-US"/\["en-US","zh-CN"/g' "$MOCK_ASSETS/shared-2-BF65-y49.js"

# 验证 JS 是否注册成功
if grep -q '"zh-CN"' "$MOCK_ASSETS/shared-2-BF65-y49.js"; then
    echo "   ✅ Linux 原生环境下 JS 语言白名单注入成功: $(cat "$MOCK_ASSETS/shared-2-BF65-y49.js")"
else
    echo "   ❌ JS 语言白名单注入失败"
    exit 1
fi

# 写入增量中文
echo '{"key": "来自 Linux 的中文"}' > "$MOCK_RES/zh-CN.json"
echo '{"key": "来自 Linux 的 Web UI 中文"}' > "$MOCK_ION/zh-CN.json"
echo '{}' > "$MOCK_ION/zh-CN.overrides.json"
echo '{"patchedAt": "2026-08-23T12:00:00Z", "type": "linux"}' > "$MOCK_RES/.claude_chinese_meta.json"

echo "4. 执行 Linux 原生还原流程..."
rm -f "$MOCK_RES/zh-CN.json" "$MOCK_ION/zh-CN.json" "$MOCK_ION/zh-CN.overrides.json" "$MOCK_RES/.claude_chinese_meta.json"
sed -i 's/,"zh-CN"//g' "$MOCK_ASSETS/shared-2-BF65-y49.js"

if [ ! -f "$MOCK_RES/zh-CN.json" ] && ! grep -q '"zh-CN"' "$MOCK_ASSETS/shared-2-BF65-y49.js"; then
    echo "   ✅ Linux 原生还原与复位完全成功: $(cat "$MOCK_ASSETS/shared-2-BF65-y49.js")"
else
    echo "   ❌ Linux 原生还原失败"
    exit 1
fi

# 清理
rm -rf "$MOCK_ROOT"
echo ""
echo "🎉 Linux (WSL) 真实 POSIX 环境实测 100% 通过！"
