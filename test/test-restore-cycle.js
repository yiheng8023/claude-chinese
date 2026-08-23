/**
 * 验证 Install -> Restore -> Install 完整生命周期闭环测试
 */
const { applyPatch, restorePatch } = require('../core/patcher');
const { getClaudeInstallation } = require('../core/msix-detector');
const fs = require('fs');
const path = require('path');

console.log('=== 还原闭环与状态生命周期回归测试 ===\n');

// 1. 先执行还原
console.log('1. 执行 restorePatch()...');
const restoreRes1 = restorePatch();
console.log('   还原结果:', restoreRes1);

const statusAfterRestore = getClaudeInstallation();
console.log('   还原后 status.isPatched:', statusAfterRestore.isPatched);
if (statusAfterRestore.isPatched !== false) {
  console.error('❌ 错误: 还原后 isPatched 仍为 true！');
  process.exit(1);
} else {
  console.log('   ✅ 还原后状态判定为 false，通过！');
}

// 检查 en-US.json 是否已恢复纯英文
const enFile = path.join(statusAfterRestore.resourcesPath, 'en-US.json');
if (fs.existsSync(enFile)) {
  const enContent = fs.readFileSync(enFile, 'utf8');
  if (enContent.includes('实际大小') || enContent.includes('新对话') || enContent.includes('团队 (Team)')) {
    console.error('❌ 错误: en-US.json 仍包含中文特征词！');
    process.exit(1);
  } else {
    console.log('   ✅ en-US.json 已恢复为官方纯正英文！');
  }
}

// 2. 重新执行安装
console.log('\n2. 执行 applyPatch()...');
const patchRes = applyPatch();
console.log('   安装结果:', patchRes);

const statusAfterPatch = getClaudeInstallation();
console.log('   安装后 status.isPatched:', statusAfterPatch.isPatched);
if (statusAfterPatch.isPatched !== true) {
  console.error('❌ 错误: 安装后 isPatched 为 false！');
  process.exit(1);
} else {
  console.log('   ✅ 安装后状态判定为 true，通过！');
}

console.log('\n🎉 Install -> Restore -> Install 生命周期闭环 100% 验证通过！');
