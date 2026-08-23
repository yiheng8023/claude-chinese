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
const originalJsA = 'const xu=["en-US","ja-JP"]; label:"Inside project (.claude/worktrees)"; label:"Custom...";';
const mockJsPath = path.join(mockAssets, 'shared-bundle.js');
fs.writeFileSync(mockJsPath, originalJsA, 'utf8');

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

  // 验证 JS 物理出厂备份存在
  if (!fs.existsSync(`${mockJsPath}.orig.bak`)) {
    console.error('❌ 错误: 未生成 JS 物理出厂备份 .orig.bak！');
    process.exit(1);
  }
  console.log('   ✅ JS 出厂物理备份 .orig.bak 就绪！');

  // 2. 【P0 验证】二次重复执行 applyPatch (验证幂等性，不污染 .orig.bak)
  console.log('\n2. 执行二次重复 applyPatch({ customPath: mockDir })...');
  applyPatch({ customPath: mockDir });
  const bakContentAfterDouble = fs.readFileSync(`${mockJsPath}.orig.bak`, 'utf8');
  if (bakContentAfterDouble !== originalJsA) {
    console.error('❌ 错误: 二次安装污染了 .orig.bak 物理基准备份！');
    process.exit(1);
  }
  console.log('   ✅ 二次重复安装幂等验证通过，未污染原始基准备份！');

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

  // 验证 JS 文件是否 100% 物理恢复为原始内容 A
  const restoredJsA = fs.readFileSync(mockJsPath, 'utf8');
  if (restoredJsA !== originalJsA) {
    console.error('❌ 错误: JS 物理还原后内容与原始出厂内容不一致！');
    process.exit(1);
  }
  console.log('   ✅ JS 资源通过 .orig.bak 100% 权威物理出厂还原！');

  // 验证官方 en-US.json 字节级未被篡改
  const currentEn = fs.readFileSync(path.join(mockRes, 'en-US.json'), 'utf8');
  if (currentEn !== baseEn) {
    console.error('❌ 错误: restorePatch 篡改了官方原版 en-US.json！');
    process.exit(1);
  }
  console.log('   ✅ 官方原版 en-US.json 100% 保持纯净未修改！');

  // 4. 【P0 验证】模拟上游发版升级为 JS 版本 B
  console.log('\n4. 模拟官方升级为全新 JS 资源 (版本 B)...');
  const originalJsB = 'const xu=["en-US","ja-JP"]; label:"Inside project (.claude/worktrees)"; label:"Custom..."; const newFeature="vB";';
  fs.writeFileSync(mockJsPath, originalJsB, 'utf8');

  // 在版本 B 上打补丁
  applyPatch({ customPath: mockDir });
  // 在版本 B 上再次重复打补丁
  applyPatch({ customPath: mockDir });

  // 还原版本 B
  restorePatch({ customPath: mockDir });
  const restoredJsB = fs.readFileSync(mockJsPath, 'utf8');
  if (restoredJsB !== originalJsB) {
    console.error('❌ 错误: 版本 B 还原后未能恢复为版本 B 原版！');
    process.exit(1);
  }
  console.log('   ✅ 上游升级版本 B 注入、重复注入与还原 100% 精准恢复为版本 B！');

  console.log('\n🎉 生命周期与出厂基线原子回滚 100% 全部验证通过！');
} finally {
  // 清理临时 Mock 目录
  if (mockDir && fs.existsSync(mockDir)) {
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
}
