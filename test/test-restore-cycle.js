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

  // 5. 【P1 终极防御】模拟在“未执行 restore、磁盘存留旧版 .orig.bak”时，官方后台静默推送版本 C
  console.log('\n5. 【P1 专项验证】模拟留存旧 .orig.bak 时，官方后台静默热更新为版本 C...');
  // 5.1 先在当前状态打上补丁，生成版本 B 的 .orig.bak
  applyPatch({ customPath: mockDir });
  if (!fs.existsSync(`${langJsPath}.orig.bak`)) {
    console.error('❌ 错误: 注入后未找到 .orig.bak！');
    process.exit(1);
  }

  // 5.2 模拟官方静默更新为版本 C（直接覆写 bundle，磁盘上留下版本 B 的 .orig.bak）
  const origLangJsC = 'const xu=["en-US","ja-JP"]; const featureC=true;';
  const origWorktreeJsC = 'label:"Inside project (.claude/worktrees)"; label:"Custom..."; const wc=true;';
  fs.writeFileSync(langJsPath, origLangJsC, 'utf8');
  fs.writeFileSync(worktreeJsPath, origWorktreeJsC, 'utf8');

  // 5.3 触发守护进程或再次安装 applyPatch
  applyPatch({ customPath: mockDir });

  // 5.4 验证：打补丁后的内容必须基于版本 C，绝不能被旧的 bak (版本 B) 覆盖降级！
  const patchedLangC = fs.readFileSync(langJsPath, 'utf8');
  if (!patchedLangC.includes('featureC=true') || !patchedLangC.includes('"zh-CN"')) {
    console.error('❌ 致命错误: applyPatch 从陈旧 .orig.bak 读取了旧版本，将官方新版本 C 降级了！');
    process.exit(1);
  }

  // 验证：.orig.bak 必须已被自动刷新为版本 C 的纯净出厂内容
  const updatedBakC = fs.readFileSync(`${langJsPath}.orig.bak`, 'utf8');
  if (updatedBakC !== origLangJsC) {
    console.error('❌ 致命错误: .orig.bak 基线未被自动刷新为官方新版本 C！');
    process.exit(1);
  }
  console.log('   ✅ applyPatch 成功识别官方静默升级，自动刷新备份基线，0 版本回退！');

  // 5.5 验证 restorePatch 防御：如果官方推送了版本 D（纯净原版），restorePatch 绝不能用旧 bak 覆盖官方新版
  const origLangJsD = 'const xu=["en-US","ja-JP"]; const featureD=true;';
  fs.writeFileSync(langJsPath, origLangJsD, 'utf8'); // 模拟官方直接更新为 D
  restorePatch({ customPath: mockDir });

  const currentAfterRestoreD = fs.readFileSync(langJsPath, 'utf8');
  if (currentAfterRestoreD !== origLangJsD) {
    console.error('❌ 致命错误: restorePatch 用旧 .orig.bak 覆盖了官方更新后的版本 D！');
    process.exit(1);
  }
  if (fs.existsSync(`${langJsPath}.orig.bak`)) {
    console.error('❌ 错误: restorePatch 未清除陈旧的 .orig.bak！');
    process.exit(1);
  }
  console.log('   ✅ restorePatch 成功保护官方更新版本 D，绝不降级覆盖，陈旧备份安全清理！');

  // 6. 【CL-04 专项验证】确立官方当前 en-US.json 权威基线，消除陈旧 en-US.backup.json 覆盖风险
  console.log('\n6. 【CL-04 专项验证】官方更新 en-US.json 且留存旧 en-US.backup.json 防降级断言...');
  const enUsPath = path.join(mockRes, 'en-US.json');
  const enUsBakPath = path.join(mockRes, 'en-US.backup.json');

  // 6.1 构造陈旧的 en-US.backup.json
  const legacyBakContent = JSON.stringify({ "key": "Old legacy baseline", "deprecatedKey": "Old" });
  fs.writeFileSync(enUsBakPath, legacyBakContent, 'utf8');

  // 6.2 构造官方最新版本推送的 en-US.json (包含全新键值且未被污染)
  const officialNewEnContent = JSON.stringify({ "key": "New pristine baseline", "newUpstreamKey": "Fresh from Anthropic" });
  fs.writeFileSync(enUsPath, officialNewEnContent, 'utf8');

  // 6.3 执行 applyPatch
  applyPatch({ customPath: mockDir });

  // 6.4 断言：新生成的 zh-CN.json 必须基于官方最新 en-US.json，包含 newUpstreamKey
  const generatedZh = JSON.parse(fs.readFileSync(path.join(mockRes, 'zh-CN.json'), 'utf8'));
  if (generatedZh.newUpstreamKey !== 'Fresh from Anthropic') {
    console.error('❌ 致命错误: applyPatch 增量字典合并未能采纳官方最新 en-US，错误回退至陈旧备份！');
    process.exit(1);
  }
  console.log('   ✅ applyPatch 成功确立官方最新 en-US 为绝对权威基准，增量字典继承最新词条！');

  // 6.5 断言：官方原生未污染的 en-US.json 必须 100% 保持不变，陈旧备份被安全清理
  const finalEnUs = fs.readFileSync(enUsPath, 'utf8');
  if (finalEnUs !== officialNewEnContent) {
    console.error('❌ 致命错误: sanitizeEnUS 用旧备份覆盖了官方全新 en-US.json！');
    process.exit(1);
  }
  if (fs.existsSync(enUsBakPath)) {
    console.error('❌ 错误: sanitizeEnUS 未清理陈旧的 en-US.backup.json！');
    process.exit(1);
  }
  console.log('   ✅ sanitizeEnUS 成功保护官方全新 en-US.json，陈旧 en-US 备份已安全清理！');

  console.log('\n🎉 生命周期、出厂基线原子回滚与官方静默更新自愈防降级 100% 全部验证通过！');
} finally {
  // 清理临时 Mock 目录
  if (mockDir && fs.existsSync(mockDir)) {
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
}
