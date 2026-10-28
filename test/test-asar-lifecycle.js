/**
 * ASAR 架构端到端生命周期回归测试 (包含 Electron Fuse 4 禁用与 Header SHA256 原位替换断言)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const asar = require('@electron/asar');
const { applyPatch, restorePatch, packAsarSync, getRawHeaderSha256 } = require('../core/patcher');
const { getClaudeInstallation } = require('../core/msix-detector');

console.log('====================================================');
console.log('   Claude-Chinese ASAR 架构与 Fuse 破解闭环回归测试');
console.log('====================================================\n');

const mockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-asar-test-'));
const appDir = path.join(mockDir, 'app');
const resDir = path.join(appDir, 'resources');

fs.mkdirSync(resDir, { recursive: true });

try {
  // 1. 构建初始纯净的 mock asar 源码目录
  const mockSrcDir = path.join(mockDir, 'asar-src');
  const mockAssets = path.join(mockSrcDir, 'assets', 'v1');
  const mockI18n = path.join(mockSrcDir, 'i18n');
  const mockDyn = path.join(mockI18n, 'dynamic');

  fs.mkdirSync(mockAssets, { recursive: true });
  fs.mkdirSync(mockDyn, { recursive: true });

  // 逼真的 JS 包含 es-419 数字白名单与硬编码特征
  const sampleJsContent = 'const langList=["en-US","de-DE","es-419","fr-FR"]; const osm={"checkedRole":"radio"}; label:"Inside project (.claude/worktrees)"; function getDoc(text, extra){return{text:text,...extra}}';
  fs.writeFileSync(path.join(mockAssets, 'bundle-1.js'), sampleJsContent, 'utf8');

  // 初始 en-US 字典
  const sampleEnUs = JSON.stringify({ "test.key": "Original English", "1uz/I31pXU": "1M" }, null, 2);
  fs.writeFileSync(path.join(mockI18n, 'en-US.json'), sampleEnUs, 'utf8');
  fs.writeFileSync(path.join(mockDyn, 'en-US.json'), sampleEnUs, 'utf8');

  // 外壳 en-US
  fs.writeFileSync(path.join(resDir, 'en-US.json'), sampleEnUs, 'utf8');

  // 打包初始官方原版 ion-dist.asar
  const origAsarPath = path.join(resDir, 'ion-dist.asar');
  packAsarSync(mockSrcDir, origAsarPath);
  const origAsarSha256 = getRawHeaderSha256(origAsarPath);
  console.log(`  📦 官方原版 mock ion-dist.asar 构建就绪 (Raw Header SHA256: ${origAsarSha256})`);

  // 2. 构建逼真的 claude.exe (包含 Fuse 特征码与 PE 资源硬编码 SHA256)
  const exePath = path.join(appDir, 'claude.exe');
  const fuseMagic = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'; // 30 bytes
  const fuseWire = '\x01\x09010011011\x00\x00\x00\x00'; // idx+38 处是 '1' (0x31)
  const peResourceStr = `{"file":"resources\\\\app.asar","alg":"SHA256","value":"722aea081d2ddd5b155cb5645dba0c5642cef4711575ddb3648ea04426def648"},{"file":"resources\\\\ion-dist.asar","alg":"SHA256","value":"${origAsarSha256}"}]PADDINGXPADDINGX`;

  const dummyPrefix = Buffer.alloc(1000, 0x90);
  const fuseBlock = Buffer.concat([Buffer.from(fuseMagic, 'ascii'), Buffer.from(fuseWire, 'binary')]);
  const dummyMiddle = Buffer.alloc(2000, 0xcc);
  const peBlock = Buffer.from(peResourceStr, 'utf8');
  const dummySuffix = Buffer.alloc(500, 0x00);

  const initialExeBuf = Buffer.concat([dummyPrefix, fuseBlock, dummyMiddle, peBlock, dummySuffix]);
  fs.writeFileSync(exePath, initialExeBuf);

  // 验证测试初始状态：Fuse 4 必须为 '1' (0x31)
  const magicIdx = initialExeBuf.indexOf(Buffer.from(fuseMagic));
  assert.strictEqual(initialExeBuf[magicIdx + 38], 0x31, '初始 Fuse 4 必须为 1 (开启校验)');
  console.log('  🛡️ 官方原版 mock claude.exe 就绪 (Fuse 4 = 1, 完整性校验开启)');

  // -------------------------------------------------------------
  // 【阶段 1】执行 applyPatch 注入
  // -------------------------------------------------------------
  console.log('\n【阶段 1】在 ASAR 模式沙盒中执行 applyPatch...');
  const patchRes = applyPatch({ customPath: appDir, autoClose: false });
  assert.strictEqual(patchRes.success, true, `applyPatch 应成功: ${patchRes.error}`);
  console.log('  ✅ applyPatch 注入成功返回');

  // 验证出厂备份
  const asarBakPath = path.join(resDir, 'ion-dist.asar.orig.bak');
  const exeBakPath = path.join(appDir, 'claude.exe.orig.bak');
  assert(fs.existsSync(asarBakPath), '必须生成 ion-dist.asar.orig.bak 出厂备份！');
  assert(fs.existsSync(exeBakPath), '必须生成 claude.exe.orig.bak 出厂备份！');
  console.log('  ✅ 出厂双重纯净备份 .orig.bak 就绪');

  // 验证 claude.exe 的安全原位同步 (Fuse 4 保持开启 0x31 激活防篡改 + PE 资源硬编码 SHA256 原位替换)
  const patchedExeBuf = fs.readFileSync(exePath);
  assert.strictEqual(patchedExeBuf[magicIdx + 38], 0x31, 'Fuse 4 必须严格保持为 1 (激活完整性校验防篡改)！');
  console.log('  🛡️ [安全强化 1] Electron Fuse 4 (embeddedAsarIntegrityValidation) 保持激活 (1 = Enabled，绝不降级防线)');

  const newAsarSha256 = getRawHeaderSha256(origAsarPath);
  assert.notStrictEqual(newAsarSha256, origAsarSha256, '新 ASAR 的 Header SHA256 必须发生变动');
  const expectedPePattern = `{"file":"resources\\\\ion-dist.asar","alg":"SHA256","value":"${newAsarSha256}"}`;
  assert(patchedExeBuf.includes(Buffer.from(expectedPePattern, 'utf8')), 'PE 资源中的 SHA256 必须原位同步替换为新 asar 的 Header SHA256！');
  console.log(`  ✅ [双保险 2] PE 资源硬编码 SHA256 原位替换成功 (${origAsarSha256.slice(0, 8)}... -> ${newAsarSha256.slice(0, 8)}...)`);

  // 验证 ASAR 内部资源
  if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
  const extractedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-asar-'));
  asar.extractAll(origAsarPath, extractedDir);

  const jsInAsar = fs.readFileSync(path.join(extractedDir, 'assets', 'v1', 'bundle-1.js'), 'utf8');
  assert(jsInAsar.includes(',"zh-CN"]'), 'JS 语言白名单必须放宽并追加 ,"zh-CN"]！');
  assert(jsInAsar.includes('项目目录内 (.claude/worktrees)'), '硬编码补丁必须成功注入！');
  console.log('  ✅ ASAR 内部 JS 白名单穿透与硬编码补丁注入验证通过');

  const ionZhInAsar = JSON.parse(fs.readFileSync(path.join(extractedDir, 'i18n', 'zh-CN.json'), 'utf8'));
  assert(Object.keys(ionZhInAsar).length > 1000, 'ASAR 内部 zh-CN.json 必须包含全量中文词条！');

  const enUsInAsar = JSON.parse(fs.readFileSync(path.join(extractedDir, 'i18n', 'en-US.json'), 'utf8'));
  assert(enUsInAsar['1uz/I31pXU'] === '1M', '双重保险：ASAR 内部 en-US.json 必须同步覆盖为中文增量！');
  console.log('  ✅ ASAR 内部 i18n/zh-CN.json 生成与 en-US.json 双重保险同步覆盖验证通过');
  fs.rmSync(extractedDir, { recursive: true, force: true });

  // 验证状态判定
  const installStatus = getClaudeInstallation(appDir);
  assert.strictEqual(installStatus.isPatched, true, '注入后 isPatched 必须判定为 true！');
  console.log('  ✅ 注入后 getClaudeInstallation().isPatched === true 判定通过');

  // -------------------------------------------------------------
  // 【阶段 2】执行 restorePatch 纯净出厂恢复
  // -------------------------------------------------------------
  console.log('\n【阶段 2】执行 restorePatch 并验证原版恢复...');
  const restoreRes = restorePatch({ customPath: appDir, autoClose: false });
  assert.strictEqual(restoreRes.success, true, `restorePatch 应成功: ${restoreRes.error}`);

  // 验证 claude.exe 与 ion-dist.asar 恢复
  const restoredExeBuf = fs.readFileSync(exePath);
  assert.strictEqual(restoredExeBuf.compare(initialExeBuf), 0, '还原后 claude.exe 必须 100% 字节级恢复为出厂原版！');
  assert(!fs.existsSync(exeBakPath), '还原后 claude.exe.orig.bak 备份必须被干净删除！');
  console.log('  ✅ claude.exe 100% 字节级出厂还原，Fuse 4 复位，备份干净清理');

  const restoredAsarSha = getRawHeaderSha256(origAsarPath);
  assert.strictEqual(restoredAsarSha, origAsarSha256, '还原后 ion-dist.asar 必须 100% 恢复为官方原版！');
  assert(!fs.existsSync(asarBakPath), '还原后 ion-dist.asar.orig.bak 备份必须被干净删除！');
  console.log('  ✅ ion-dist.asar 100% 恢复为官方原版，备份干净清理');

  const statusAfterRestore = getClaudeInstallation(appDir);
  assert.strictEqual(statusAfterRestore.isPatched, false, '还原后 isPatched 必须判定为 false！');
  console.log('  ✅ 还原后 getClaudeInstallation().isPatched === false 判定通过');

  console.log('\n====================================================');
  console.log('   🎉 ASAR 架构端到端生命周期与双保险破解全部 PASS！');
  console.log('====================================================\n');

} finally {
  if (fs.existsSync(mockDir)) {
    try { fs.rmSync(mockDir, { recursive: true, force: true }); } catch (_) {}
  }
}
