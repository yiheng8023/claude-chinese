/**
 * 验证 Install -> Restore -> Install 完整生命周期闭环回归测试 (沙盒隔离环境)
 */
const { applyPatch, restorePatch } = require('../core/patcher');
const { getClaudeInstallation } = require('../core/msix-detector');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== 还原闭环与状态生命周期回归测试 ===\n');

const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-lifecycle-'));
const mockRes = path.join(mockDir, 'resources');
const mockIon = path.join(mockRes, 'ion-dist', 'i18n');
const mockDyn = path.join(mockIon, 'dynamic');
const mockAssets = path.join(mockRes, 'ion-dist', 'assets', 'v1');

fs.mkdirSync(mockDyn, { recursive: true });
fs.mkdirSync(mockAssets, { recursive: true });

// 写入基线 en-US.json (官方版本 A)
const baseEn = JSON.stringify({ "key": "Hello world" }, null, 2);
fs.writeFileSync(path.join(mockRes, 'en-US.json'), baseEn, 'utf8');
fs.writeFileSync(path.join(mockIon, 'en-US.json'), baseEn, 'utf8');
fs.writeFileSync(path.join(mockDyn, 'en-US.json'), baseEn, 'utf8');

// 逼真的多 Bundle 分离架构 (language.js, worktree.js, unrelated.js)
const origLangJsA = 'const xu=["en-US","ja-JP"];';
const origWorktreeJsA = 'label:"Inside project (.claude/worktrees)"; label:"Custom...";';
const origUnrelatedJsA = 'const unrelatedCode = true;';

const langJsPath = path.join(mockAssets, 'language-bundle.js');
const worktreeJsPath = path.join(mockAssets, 'worktree-bundle.js');
const unrelatedJsPath = path.join(mockAssets, 'unrelated-bundle.js');

fs.writeFileSync(langJsPath, origLangJsA, 'utf8');
fs.writeFileSync(worktreeJsPath, origWorktreeJsA, 'utf8');
fs.writeFileSync(unrelatedJsPath, origUnrelatedJsA, 'utf8');

try {
  // 1. 首次注入测试
  console.log('1. 执行 applyPatch({ customPath: mockDir })...');
  const patchRes = applyPatch({ customPath: mockDir });
  if (!patchRes.success) {
    console.error('❌ 注入失败:', patchRes.error);
    process.exit(1);
  }
  console.log('   ✅ 首次注入完成');

  // 验证注入后状态
  const statusAfterPatch = getClaudeInstallation(mockDir);
  if (statusAfterPatch.isPatched !== true) {
    console.error('❌ 错误: 注入后 isPatched 判定为 false！');
    process.exit(1);
  }

  // 验证按需精准备份：修改过的文件必须有备份，未修改的不创建备份
  if (!fs.existsSync(`${langJsPath}.orig.bak`)) {
    console.error('❌ 错误: 未生成 language-bundle.js.orig.bak！');
    process.exit(1);
  }
  if (!fs.existsSync(`${worktreeJsPath}.orig.bak`)) {
    console.error('❌ 错误: 未生成 worktree-bundle.js.orig.bak！');
    process.exit(1);
  }
  if (fs.existsSync(`${unrelatedJsPath}.orig.bak`)) {
    console.error('❌ 错误: 未修改的 unrelated-bundle.js 产生了多余的 .orig.bak 备份！');
    process.exit(1);
  }
  console.log('   ✅ JS 按需精确物理出厂备份就绪，未修改文件 0 冗余备份！');

  // 2. 【P0/P1 验证】二次重复执行 applyPatch (多 bundle 分离场景下，即使 worktree 不含 "zh-CN"，也绝不污染 .orig.bak)
  console.log('\n2. 执行二次重复 applyPatch({ customPath: mockDir })...');
  applyPatch({ customPath: mockDir });
  const bakWorktreeAfterDouble = fs.readFileSync(`${worktreeJsPath}.orig.bak`, 'utf8');
  if (bakWorktreeAfterDouble !== origWorktreeJsA) {
    console.error('❌ 错误: 二次安装污染了独立 worktree-bundle.js 的 .orig.bak 物理基准备份！');
    process.exit(1);
  }
  console.log('   ✅ 二次重复安装幂等验证通过，独立 Literal Bundle 基准备份未被污染！');

  // 3. 执行还原测试
  console.log('\n3. 执行 restorePatch({ customPath: mockDir })...');
  const restoreRes = restorePatch({ customPath: mockDir });
  if (!restoreRes.success) {
    console.error('❌ 还原失败:', restoreRes.error);
    process.exit(1);
  }
  console.log('   ✅ 还原完成');

  // 验证还原后状态
  const statusAfterRestore = getClaudeInstallation(mockDir);
  if (statusAfterRestore.isPatched !== false) {
    console.error('❌ 错误: 还原后 isPatched 仍为 true！');
    process.exit(1);
  }
  console.log('   ✅ 还原后状态判定为 false，通过！');

  // 验证各 Bundle 文件是否 100% 物理恢复为原始内容 A
  const restoredLangJsA = fs.readFileSync(langJsPath, 'utf8');
  const restoredWorktreeJsA = fs.readFileSync(worktreeJsPath, 'utf8');
  if (restoredLangJsA !== origLangJsA || restoredWorktreeJsA !== origWorktreeJsA) {
    console.error('❌ 错误: JS 物理还原后内容与原始出厂内容不一致！');
    process.exit(1);
  }
  console.log('   ✅ 多 Bundle JS 资源通过 .orig.bak 100% 权威物理出厂还原！');

  // 验证官方 en-US.json 字节级未被篡改
  const currentEn = fs.readFileSync(path.join(mockRes, 'en-US.json'), 'utf8');
  if (currentEn !== baseEn) {
    console.error('❌ 错误: restorePatch 篡改了官方原版 en-US.json！');
    process.exit(1);
  }
  console.log('   ✅ 官方原版 en-US.json 100% 保持纯净未修改！');

  // 4. 【P0/P1 验证】模拟官方升级为全新多 Bundle 版本 B
  console.log('\n4. 模拟官方升级为全新 JS 资源 (版本 B)...');
  const origLangJsB = 'const xu=["en-US","ja-JP"]; const featureB=true;';
  const origWorktreeJsB = 'label:"Inside project (.claude/worktrees)"; label:"Custom..."; const wb=true;';
  fs.writeFileSync(langJsPath, origLangJsB, 'utf8');
  fs.writeFileSync(worktreeJsPath, origWorktreeJsB, 'utf8');

  // 在版本 B 上打补丁并二次重复打补丁
  applyPatch({ customPath: mockDir });
  applyPatch({ customPath: mockDir });

  // 还原版本 B
  restorePatch({ customPath: mockDir });
  const restoredLangJsB = fs.readFileSync(langJsPath, 'utf8');
  const restoredWorktreeJsB = fs.readFileSync(worktreeJsPath, 'utf8');
  if (restoredLangJsB !== origLangJsB || restoredWorktreeJsB !== origWorktreeJsB) {
    console.error('❌ 错误: 版本 B 还原后未能恢复为版本 B 原版！');
    process.exit(1);
  }
  console.log('   ✅ 上游升级版本 B 多 Bundle 注入、重复注入与还原 100% 精准恢复为版本 B！');

  console.log('\n🎉 生命周期与出厂基线原子回滚 100% 全部验证通过！');
} finally {
  // 清理临时 Mock 目录
  if (mockDir && fs.existsSync(mockDir)) {
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
}
