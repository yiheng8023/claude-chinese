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

// 写入基线 en-US.json
const baseEn = JSON.stringify({ "key": "Hello world" }, null, 2);
fs.writeFileSync(path.join(mockRes, 'en-US.json'), baseEn, 'utf8');
fs.writeFileSync(path.join(mockIon, 'en-US.json'), baseEn, 'utf8');
fs.writeFileSync(path.join(mockDyn, 'en-US.json'), baseEn, 'utf8');
const originalJs = 'const xu=["en-US","ja-JP"]; label:"Inside project (.claude/worktrees)"; label:"Custom...";';
const mockJsPath = path.join(mockAssets, 'shared-bundle.js');
fs.writeFileSync(mockJsPath, originalJs, 'utf8');

try {
  // 1. 首次注入测试
  console.log('1. 执行 applyPatch({ customPath: mockDir })...');
  const patchRes = applyPatch({ customPath: mockDir });
  if (!patchRes.success) {
    console.error('❌ 注入失败:', patchRes.error);
    process.exit(1);
  }
  console.log('   ✅ 注入完成');

  // 验证注入后状态
  const statusAfterPatch = getClaudeInstallation(mockDir);
  console.log('   注入后 status.isPatched:', statusAfterPatch.isPatched);
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

  // 2. 执行还原测试
  console.log('\n2. 执行 restorePatch({ customPath: mockDir })...');
  const restoreRes = restorePatch({ customPath: mockDir });
  if (!restoreRes.success) {
    console.error('❌ 还原失败:', restoreRes.error);
    process.exit(1);
  }
  console.log('   ✅ 还原完成');

  // 验证还原后状态
  const statusAfterRestore = getClaudeInstallation(mockDir);
  console.log('   还原后 status.isPatched:', statusAfterRestore.isPatched);
  if (statusAfterRestore.isPatched !== false) {
    console.error('❌ 错误: 还原后 isPatched 仍为 true！');
    process.exit(1);
  }
  console.log('   ✅ 还原后状态判定为 false，通过！');

  // 验证 JS 文件是否 100% 物理恢复为原始内容
  const restoredJs = fs.readFileSync(mockJsPath, 'utf8');
  if (restoredJs !== originalJs) {
    console.error('❌ 错误: JS 物理还原后内容与原始出厂内容不一致！');
    process.exit(1);
  }
  console.log('   ✅ JS 资源通过 .orig.bak 100% 权威物理出厂还原！');

  // 3. 再次执行注入 (验证生命周期可逆循环)
  console.log('\n3. 再次执行 applyPatch({ customPath: mockDir })...');
  const rePatchRes = applyPatch({ customPath: mockDir });
  const statusRePatched = getClaudeInstallation(mockDir);
  if (statusRePatched.isPatched !== true) {
    console.error('❌ 错误: 再次注入后 isPatched 为 false！');
    process.exit(1);
  }
  console.log('   ✅ 再次注入后状态判定为 true，通过！');

  console.log('\n🎉 Install -> Restore -> Install 生命周期可逆闭环 100% 验证通过！');
} finally {
  // 清理临时 Mock 目录
  if (mockDir && fs.existsSync(mockDir)) {
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
}
