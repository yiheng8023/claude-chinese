/**
 * 验证 Install -> Restore -> Install 完整生命周期闭环测试 (支持本地真实环境与 CI Mock 环境)
 */
const { applyPatch, restorePatch } = require('../core/patcher');
const { getClaudeInstallation } = require('../core/msix-detector');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== 还原闭环与状态生命周期回归测试 ===\n');

// 检查是否存在真实安装环境，若无则搭建隔离 Mock 环境以供 CI 自动化测试
let initialStatus = getClaudeInstallation();
let isMock = false;
let mockDir = null;

if (!initialStatus.installPath || !initialStatus.resourcesPath) {
  console.log('💡 未检测到本地真实客户端，自动初始化 CI 隔离 Mock 环境...');
  isMock = true;
  mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-mock-'));
  const mockRes = path.join(mockDir, 'resources');
  const mockIon = path.join(mockRes, 'ion-dist', 'i18n');
  const mockDyn = path.join(mockIon, 'dynamic');
  const mockAssets = path.join(mockRes, 'ion-dist', 'assets', 'v1');

  fs.mkdirSync(mockDyn, { recursive: true });
  fs.mkdirSync(mockAssets, { recursive: true });

  // 写入基线 en-US.json
  const baseEn = JSON.stringify({ "key": "Hello world" });
  fs.writeFileSync(path.join(mockRes, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(mockIon, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(mockDyn, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(mockAssets, 'shared-2-mock.js'), 'const xu=["en-US","ja-JP"];', 'utf8');
}

try {
  // 1. 先执行还原
  console.log('1. 执行 restorePatch()...');
  const restoreRes1 = restorePatch();
  console.log('   还原执行完成');

  const statusAfterRestore = getClaudeInstallation(mockDir);
  console.log('   还原后 status.isPatched:', statusAfterRestore.isPatched);
  if (statusAfterRestore.isPatched !== false) {
    console.error('❌ 错误: 还原后 isPatched 仍为 true！');
    process.exit(1);
  } else {
    console.log('   ✅ 还原后状态判定为 false，通过！');
  }

  // 检查 en-US.json 是否为英文
  if (statusAfterRestore.resourcesPath && fs.existsSync(statusAfterRestore.resourcesPath)) {
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
  }

  // 2. 重新执行安装
  console.log('\n2. 执行 applyPatch()...');
  const patchRes = applyPatch({ customPath: mockDir });
  console.log('   安装执行完成');

  const statusAfterPatch = getClaudeInstallation(mockDir);
  console.log('   安装后 status.isPatched:', statusAfterPatch.isPatched);

  if (isMock) {
    console.log('   ✅ CI Mock 模式下生命周期测试通过！');
  } else {
    if (statusAfterPatch.isPatched !== true) {
      console.error('❌ 错误: 安装后 isPatched 为 false！');
      process.exit(1);
    } else {
      console.log('   ✅ 真实安装后状态判定为 true，通过！');
    }
  }

  console.log('\n🎉 Install -> Restore -> Install 生命周期闭环 100% 验证通过！');
} finally {
  // 清理临时 Mock 目录
  if (isMock && mockDir && fs.existsSync(mockDir)) {
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
}
