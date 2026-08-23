/**
 * 全平台 (Windows / macOS / Linux) 探测与注入真实代码断言测试 (跨平台真机与 CI 必备)
 * 验证核心代码：msix-detector.js 与 patcher.js 在全平台路径解析、增量注入、JS 白名单穿透与还原复位
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClaudeInstallation } = require('../core/msix-detector');
const { applyPatch, restorePatch } = require('../core/patcher');

console.log('====================================================');
console.log(`   全平台真实核心代码跨平台断言测试 (Runner OS: ${process.platform})`);
console.log('====================================================\n');

function runPlatformTestSuite(testId, displayName, isMacBundle = false) {
  console.log(`\n--- [测试平台: ${displayName}] ---`);
  
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `claude-test-${testId}-`));
  const appRoot = isMacBundle ? path.join(tmpRoot, 'Claude.app') : tmpRoot;
  const resDir = isMacBundle
    ? path.join(appRoot, 'Contents', 'Resources')
    : path.join(appRoot, 'resources');
    
  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');

  fs.mkdirSync(dynDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // 写入基线官方英文与前端编译 JS 文件（包含真实的官方语言白名单数组）
  const baseEn = JSON.stringify({ "key": `Hello from ${displayName} Claude` });
  fs.writeFileSync(path.join(resDir, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(i18nDir, 'en-US.json'), baseEn, 'utf8');
  fs.writeFileSync(path.join(dynDir, 'en-US.json'), baseEn, 'utf8');
  
  // 模拟真实官方 JS: const xu=["en-US","ja-JP"];
  const jsFilePath = path.join(assetsDir, 'shared-2-BF65-y49.js');
  fs.writeFileSync(jsFilePath, 'var vU=["en-US","ja-JP","de-DE"];', 'utf8');

  try {
    // 1. 验证路径探测与解析
    console.log('  1. 验证 customPath 跨平台路径解析...');
    const detected = getClaudeInstallation(appRoot);
    if (!detected.resourcesPath || path.resolve(detected.resourcesPath) !== path.resolve(resDir)) {
      console.error(`  ❌ 路径解析断言失败! 期望: ${resDir}, 实际: ${detected.resourcesPath}`);
      process.exit(1);
    }
    console.log(`  ✅ 路径解析成功: ${detected.resourcesPath}`);

    // 2. 验证真实 applyPatch 注入
    console.log('  2. 验证 applyPatch 核心注入与 JS 白名单正则穿透...');
    const patchRes = applyPatch({ customPath: appRoot });
    if (!patchRes.success) {
      console.error('  ❌ 注入失败:', patchRes.error);
      process.exit(1);
    }

    // 检查 JS 文件中是否真正由 patcher.js 写入了 "zh-CN"
    const patchedJsContent = fs.readFileSync(jsFilePath, 'utf8');
    if (!patchedJsContent.includes('"zh-CN"')) {
      console.error('  ❌ patcher.js 未能通过正则在 JS 文件中注册 "zh-CN"!');
      process.exit(1);
    }
    console.log('  ✅ JS 语言白名单通过 patcher.js 正则成功穿透注册!');

    // 检查 zh-CN.json 与 meta 是否生成
    if (!fs.existsSync(path.join(resDir, 'zh-CN.json')) || !fs.existsSync(path.join(resDir, '.claude_chinese_meta.json'))) {
      console.error('  ❌ 注入文件缺失!');
      process.exit(1);
    }
    console.log('  ✅ 增量 zh-CN.json 与补丁元数据就绪!');

    // 3. 验证 status 状态断言
    console.log('  3. 验证汉化后 status 判定...');
    const patchedStatus = getClaudeInstallation(appRoot);
    if (patchedStatus.isPatched !== true) {
      console.error('  ❌ 注入后 isPatched 判定异常: false');
      process.exit(1);
    }
    console.log('  ✅ 注入后 isPatched = true 断言通过!');

    // 4. 验证真实 restorePatch 还原
    console.log('  4. 验证 restorePatch 真实还原与复位...');
    const restoreRes = restorePatch({ customPath: appRoot });
    if (!restoreRes.success) {
      console.error('  ❌ 还原失败:', restoreRes.error);
      process.exit(1);
    }

    // 检查 JS 是否复原
    const restoredJsContent = fs.readFileSync(jsFilePath, 'utf8');
    if (restoredJsContent.includes('"zh-CN"')) {
      console.error('  ❌ restorePatch 未能清除 JS 中的 "zh-CN"!');
      process.exit(1);
    }
    console.log('  ✅ JS 语言白名单已由 restorePatch 干净清除!');

    // 检查 status 复位
    const finalStatus = getClaudeInstallation(appRoot);
    if (finalStatus.isPatched !== false) {
      console.error('  ❌ 还原后 isPatched 未能复位为 false!');
      process.exit(1);
    }
    console.log('  ✅ 还原后 isPatched = false 断言通过!');

    console.log(`🎉 [平台: ${displayName}] 全流程核心代码测试 100% PASS!`);
  } finally {
    // 清理沙盒
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// 依次在不同平台目录布局下运行真实核心代码测试
runPlatformTestSuite('linux-win32', 'Standard Linux / Win32 (resources/)', false);
runPlatformTestSuite('macos', 'macOS Bundle (Contents/Resources/)', true);

console.log('\n====================================================');
console.log('   全平台跨环境真实核心代码断言全部 PASS！');
console.log('====================================================\n');
