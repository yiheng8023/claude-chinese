/** Read-only checks against the actual installed bytes, not success flags alone. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const { getClaudeInstallation } = require('../core/msix-detector');
const { artifactPaths, hashFile, readMeta, verifyIntegrity } = require('../core/asar-transaction');

function verifyClient(customPath) {
  const info = getClaudeInstallation(customPath);
  assert(info.resourcesPath, info.error || '未找到安装资源');
  assert(info.isPatched && !info.needsUpdate, '实际文件或词库版本未与当前汉化对齐');
  const res = info.resourcesPath;
  const meta = readMeta(res);
  assert.equal(meta.mode, 'asar_repack', '此检查器面向 Windows 双 ASAR 布局');
  for (const [name, file] of artifactPaths(res)) {
    assert.equal(hashFile(file), meta.archives[name].patchedHash, `${name} 实际补丁哈希`);
    assert.equal(hashFile(file + '.orig.bak'), meta.archives[name].originalHash, `${name} 原版备份哈希`);
  }
  verifyIntegrity(res, path.join(path.dirname(res), 'claude.exe'));
  for (const [archive, entry] of [
    ['app.asar', path.join('resources', 'i18n', 'en-US.json')],
    ['ion-dist.asar', path.join('i18n', 'en-US.json')],
    ['ion-dist.asar', path.join('i18n', 'dynamic', 'en-US.json')]
  ]) {
    assert.deepEqual(asar.extractFile(path.join(res, archive), entry), asar.extractFile(path.join(res, archive + '.orig.bak'), entry), `${archive}/${entry} 英文原始字节`);
  }
  const app = path.join(res, 'app.asar');
  const localeFiles = asar.listPackage(app).filter(file => file.endsWith('.js') && file.includes('build'));
  let registered = 0;
  for (const file of localeFiles) {
    const code = asar.extractFile(app, file.replace(/^[\\/]/, '')).toString('utf8');
    if (code.includes('zh:"zh-CN","zh-CN":"zh-CN","zh-Hans":"zh-CN"')) registered++;
  }
  assert.equal(registered, 1, '主进程中文语言注册');
  function fuseWire(file) {
    const buffer = fs.readFileSync(file);
    const index = buffer.indexOf('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
    assert(index >= 0 && buffer[index + 38] === 0x31, 'Fuse 4 必须保持开启');
    return buffer.subarray(index + 32, index + 34 + buffer[index + 33]);
  }
  const exe = path.join(path.dirname(res), 'claude.exe');
  assert.deepEqual(fuseWire(exe), fuseWire(exe + '.orig.bak'), '熔丝向量保持原样');
  return { verified: true, clientVersion: info.version, toolkitVersion: meta.toolkitVersion,
    resourcesPath: res, checks: ['actual-file-hashes', 'original-backups', 'embedded-asar-integrity', 'english-bytes-preserved', 'shell-locale-registered', 'fuses-unchanged'] };
}

if (require.main === module) {
  try { console.log(JSON.stringify(verifyClient(process.argv[2]), null, 2)); }
  catch (error) { console.error(`验证失败: ${error.message}`); process.exitCode = 1; }
}
module.exports = { verifyClient };
