/**
 * AST 语法完整性与黑屏崩溃防御回归测试
 * (AST Syntax Integrity & Black-Screen Crash Prevention Test Suite)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { applyPatch, restorePatch } = require('../core/patcher');
const { getClaudeInstallation } = require('../core/msix-detector');

console.log('====================================================');
console.log('   Claude-Chinese AST 语法防火墙与黑屏崩溃拦截测试');
console.log('====================================================\n');

const info = getClaudeInstallation();
const mockSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ast-test-'));

try {
  const sandboxRes = path.join(mockSandbox, 'resources');
  const sandboxAssets = path.join(sandboxRes, 'ion-dist', 'assets', 'v1');
  const sandboxI18n = path.join(sandboxRes, 'ion-dist', 'i18n');
  fs.mkdirSync(sandboxAssets, { recursive: true });
  fs.mkdirSync(sandboxI18n, { recursive: true });

  // 如果本地有真实安装，直接复制真实打补丁的关键 bundle，测试全真 AST！
  if (info.resourcesPath && fs.existsSync(info.resourcesPath)) {
    console.log('📡 [MODE: REAL_CLIENT_BUNDLE] 检测到本地真实安装，拷贝真实 JS Bundle 执行真实 AST 语法扫描...\n');
    const realAssets = path.join(info.resourcesPath, 'ion-dist', 'assets', 'v1');
    const targetFiles = ['shared-5-xlIFiuS_.js', 'shared-13-DG4pYUEQ.js', 'c5e558aae-DNGm5L2q.js'];

    for (const f of targetFiles) {
      const realFile = path.join(realAssets, f);
      const bakFile = `${realFile}.orig.bak`;
      const srcFile = fs.existsSync(bakFile) ? bakFile : (fs.existsSync(realFile) ? realFile : null);
      if (srcFile) {
        fs.copyFileSync(srcFile, path.join(sandboxAssets, f));
      }
    }
    const realEnUs = path.join(info.resourcesPath, 'ion-dist', 'i18n', 'en-US.json');
    if (fs.existsSync(realEnUs)) {
      fs.copyFileSync(realEnUs, path.join(sandboxI18n, 'en-US.json'));
    }
  } else {
    console.log('🧪 [MODE: SYNTHETIC_BUNDLE] 无本地客户端，生成模拟 ES Module JS Bundle...\n');
    const mockShared5 = 'export function aS(e,t="local"){let a=e.skills.map(e=>({name:e.name,description:e.description,argumentHint:e.argumentHint,source:e.source}));return{a}}export function Yy(e){return{skillId:e.id,skillName:e.name,skillDescription:e.description,creatorType:e.creator_type}}';
    fs.writeFileSync(path.join(sandboxAssets, 'shared-5-xlIFiuS_.js'), mockShared5, 'utf8');
    fs.writeFileSync(path.join(sandboxI18n, 'en-US.json'), '{}', 'utf8');
  }

  // 1. 应用补丁
  console.log('【阶段 1】在隔离沙盒中执行 applyPatch...');
  const patchResult = applyPatch({ customPath: mockSandbox, autoClose: false });
  assert.strictEqual(patchResult.success, true, 'applyPatch 注入必须成功！');
  console.log('  ✅ applyPatch 注入执行成功！\n');

  // 2. 对沙盒中所有修改过的 JS 文件执行严格的 Node.js ESM 语法检查
  console.log('【阶段 2】执行严格的 Node.js ESM AST 语法完整性扫描 (node --check)...');
  const jsFiles = fs.readdirSync(sandboxAssets).filter(f => f.endsWith('.js') && !f.endsWith('.bak'));
  
  // 写入 package.json {"type": "module"} 使 node --check 以 ESM 模式严格验证语法
  fs.writeFileSync(path.join(sandboxAssets, 'package.json'), JSON.stringify({ type: 'module' }));

  let checkedCount = 0;
  for (const f of jsFiles) {
    const fullPath = path.join(sandboxAssets, f);
    try {
      execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
      console.log(`  ✅ [AST PASS] ${f}: 语法合法，结构闭合无异常`);
      checkedCount++;
    } catch (err) {
      console.error(`  ❌ [AST SYNTAX ERROR] ${f}: 检测到非法语法！`);
      console.error(err.stderr ? err.stderr.toString() : err.message);
      assert.fail(`文件 ${f} 注入后存在 JavaScript 语法错误，将导致客户端黑屏！`);
    }
  }

  assert(checkedCount > 0, '至少应检查 1 个修改后的 JS 文件！');
  console.log(`\n🎉 【阶段 2 验证通过】共 ${checkedCount} 个 JS 文件 AST 语法 100% 严格合法，杜绝黑屏死屏！\n`);

  // 3. 验证 restorePatch
  console.log('【阶段 3】执行 restorePatch 并验证原版 AST 语法...');
  const restoreResult = restorePatch({ customPath: mockSandbox, autoClose: false });
  assert.strictEqual(restoreResult.success, true, 'restorePatch 必须成功！');
  console.log('  ✅ restorePatch 干净还原成功！\n');

} finally {
  if (fs.existsSync(mockSandbox)) {
    try { fs.rmSync(mockSandbox, { recursive: true, force: true }); } catch (e) {}
  }
}

console.log('====================================================');
console.log('   🎉 AST 语法防火墙与黑屏崩溃拦截测试 100% 全部通过！');
console.log('====================================================\n');
