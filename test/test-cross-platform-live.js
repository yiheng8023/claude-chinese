/**
 * Linux / macOS 跨平台探测与注入真机模拟测试脚本
 * 专门用于在 Linux (WSL/CI) 或 macOS 环境下验证 detector 和 patcher 真实表现
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClaudeInstallation } = require('../core/msix-detector');
const { applyPatch, restorePatch } = require('../core/patcher');

console.log('====================================================');
console.log(`   跨平台真机/系统环境深度实测 (OS: ${process.platform})`);
console.log('====================================================\n');

// 1. 模拟 Linux 真实客户端安装路径 (/opt/claude-desktop/resources)
const testLinuxPaths = [
  '/usr/lib/claude-desktop/resources',
  '/opt/Claude/resources',
  '/opt/claude-desktop/resources'
];

console.log('【步骤 1】探测系统真实安装或候选路径...');
const detected = getClaudeInstallation();
console.log('当前探测结果:', detected);

// 2. 在临时目录或系统目录搭建 Linux 规范目录结构
const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';

if (isLinux || isMac) {
  console.log(`\n【步骤 2】在 ${process.platform} 环境下创建标准模拟应用包并实测...`);
  const targetMockRoot = isLinux ? '/tmp/claude-desktop-test' : '/tmp/Claude.app';
  const targetRes = isLinux ? path.join(targetMockRoot, 'resources') : path.join(targetMockRoot, 'Contents', 'Resources');
  const mockIon = path.join(targetRes, 'ion-dist', 'i18n');
  const mockDyn = path.join(mockIon, 'dynamic');
  const mockAssets = path.join(targetRes, 'ion-dist', 'assets', 'v1');

  fs.mkdirSync(mockDyn, { recursive: true });
  fs.mkdirSync(mockAssets, { recursive: true });

  const baseEn = JSON.stringify({ "key": "Hello from POSIX Claude" });
  fs.writeFileSync(path.join(targetRes, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(mockIon, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(mockDyn, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(mockAssets, 'shared-2-BF65-y49.js'), 'const xu=["en-US","ja-JP"];', 'utf8');

  console.log(`   已就绪模拟应用包: ${targetMockRoot}`);

  // 测试自定义与跨平台指定路径
  const customDetect = getClaudeInstallation(targetMockRoot);
  console.log('   自定义路径探测结果:', customDetect);

  if (!customDetect.resourcesPath || customDetect.resourcesPath !== targetRes) {
    console.error(`❌ 跨平台路径解析失败: 期望 ${targetRes}，实际 ${customDetect.resourcesPath}`);
    process.exit(1);
  }
  console.log('   ✅ 跨平台路径解析 100% 正确！');

  // 测试安装与注入
  console.log('\n【步骤 3】执行 POSIX 注入测试...');
  const patchRes = applyPatch({ customPath: targetMockRoot });
  console.log('   注入结果:', patchRes);

  if (!patchRes.success) {
    console.error('❌ 注入失败:', patchRes.error);
    process.exit(1);
  }
  console.log('   ✅ POSIX 增量注入与 JS 白名单修改成功！');

  // 验证注入后的 JS 文件
  const patchedJs = fs.readFileSync(path.join(mockAssets, 'shared-2-BF65-y49.js'), 'utf8');
  if (!patchedJs.includes('"zh-CN"')) {
    console.error('❌ JS 白名单未成功注入 zh-CN！');
    process.exit(1);
  }
  console.log('   ✅ JS 白名单已成功追加 "zh-CN"！');

  // 测试还原
  console.log('\n【步骤 4】执行 POSIX 还原测试...');
  const restoreRes = restorePatch({ customPath: targetMockRoot });
  console.log('   还原结果:', restoreRes);

  const afterRestore = getClaudeInstallation(targetMockRoot);
  if (afterRestore.isPatched !== false) {
    console.error('❌ 还原后状态未正确复位！');
    process.exit(1);
  }
  console.log('   ✅ POSIX 还原与状态复位 100% 成功！');

  // 清理
  fs.rmSync(targetMockRoot, { recursive: true, force: true });
} else {
  console.log('当前非 Linux/macOS 环境，请在 WSL 中运行。');
}

console.log('\n====================================================');
console.log('   跨平台深度实测全部 PASS！');
console.log('====================================================');
