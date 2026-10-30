const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const asar = require('@electron/asar');
const { applyPatch, restorePatch, packAsarSync, getRawHeaderSha256, patchClaudeExe } = require('../core/patcher');
const { hashFile } = require('../core/asar-transaction');
const { getClaudeInstallation } = require('../core/msix-detector');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-transaction-test-'));
const res = path.join(root, 'resources');
fs.mkdirSync(res);
const targets = ['ion-dist.asar', 'app.asar', '../claude.exe'];
const hashes = () => targets.map(name => hashFile(path.join(res, name)));
function writeVersion(version, mapName = 'DTt') {
  const ion = path.join(root, 'ion-source');
  const app = path.join(root, 'app-source');
  fs.mkdirSync(path.join(ion, 'i18n', 'dynamic'), { recursive: true });
  fs.mkdirSync(path.join(ion, 'assets', 'v1'), { recursive: true });
  fs.mkdirSync(path.join(app, 'resources', 'i18n'), { recursive: true });
  fs.mkdirSync(path.join(app, '.vite', 'build'), { recursive: true });
  fs.mkdirSync(path.join(app, 'native'), { recursive: true });
  fs.writeFileSync(path.join(app, 'native', 'keep.bin'), 'unpacked asset');
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ version }));
  for (const file of [path.join(ion, 'i18n', 'en-US.json'), path.join(ion, 'i18n', 'dynamic', 'en-US.json'), path.join(app, 'resources', 'i18n', 'en-US.json')]) {
    fs.writeFileSync(file, JSON.stringify({ greeting: `Original ${version}`, '1uz/I31pXU': '1M' }));
  }
  fs.writeFileSync(path.join(ion, 'assets', 'v1', 'bundle.js'), 'const languages=["en-US","de-DE","es-419"];');
  fs.writeFileSync(path.join(app, '.vite', 'build', 'index.js'), `var ${mapName}={en:"en-US",de:"de-DE",fr:"fr-FR",id:"id-ID"};new Set(Object.values(${mapName}));`);
  packAsarSync(ion, path.join(res, 'ion-dist.asar'));
  packAsarSync(app, path.join(res, 'app.asar'), { unpack: '**/keep.bin' });
  const records = ['app.asar', 'ion-dist.asar'].map(name => JSON.stringify({ file: 'resources\\' + name, alg: 'SHA256', value: getRawHeaderSha256(path.join(res, name)) })).join(',');
  fs.writeFileSync(path.join(root, 'claude.exe'), Buffer.concat([
    Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'), Buffer.from('\x01\x09010011011', 'binary'), Buffer.from(records)
  ]));
}

try {
  writeVersion('4.29.0');
  const original = hashes();
  const first = applyPatch({ customPath: root });
  assert.equal(first.success, true, first.error);
  const patched = hashes();
  assert.notDeepEqual(patched, original);
  assert.equal(getClaudeInstallation(root).isPatched, true);
  assert.equal(JSON.parse(asar.extractFile(path.join(res, 'ion-dist.asar'), path.join('i18n', 'en-US.json'))).greeting, 'Original 4.29.0');
  assert.equal(JSON.parse(asar.extractFile(path.join(res, 'app.asar'), path.join('resources', 'i18n', 'en-US.json'))).greeting, 'Original 4.29.0');
  assert.deepEqual(asar.extractFile(path.join(res, 'ion-dist.asar'), path.join('i18n', 'en-US.json')), fs.readFileSync(path.join(root, 'ion-source', 'i18n', 'en-US.json')));
  assert.deepEqual(asar.extractFile(path.join(res, 'app.asar'), path.join('resources', 'i18n', 'en-US.json')), fs.readFileSync(path.join(root, 'app-source', 'resources', 'i18n', 'en-US.json')));
  assert.equal(asar.statFile(path.join(res, 'app.asar'), path.join('native', 'keep.bin')).unpacked, true);
  assert.equal(applyPatch({ customPath: root }).success, true);
  assert.deepEqual(hashes(), patched, 'Reinstall must be idempotent');
  assert.deepEqual(targets.map(n => hashFile(path.join(res, n + '.orig.bak'))), original);

  // A failure during the second archive replacement must restore the whole set.
  const previousMeta = fs.readFileSync(path.join(res, '.claude_chinese_meta.json'));
  const copy = fs.copyFileSync;
  let injected = false;
  fs.copyFileSync = (source, dest, ...rest) => {
    if (!injected && dest === path.join(res, 'app.asar')) { injected = true; throw new Error('simulated write failure'); }
    return copy(source, dest, ...rest);
  };
  let failed;
  try { failed = applyPatch({ customPath: root }); } finally { fs.copyFileSync = copy; }
  assert.equal(failed.success, false);
  assert.equal(injected, true);
  assert.deepEqual(hashes(), patched);
  assert.deepEqual(fs.readFileSync(path.join(res, '.claude_chinese_meta.json')), previousMeta);

  // An official update left old backups behind; both reinstallation and restore
  // must preserve the NEW official version rather than reverting to 4.29.
  writeVersion('4.4212.0', '$map42');
  const upgraded = hashes();
  assert.equal(getClaudeInstallation(root).isPatched, false);
  assert.equal(applyPatch({ customPath: root }).success, true);
  assert.deepEqual(targets.map(n => hashFile(path.join(res, n + '.orig.bak'))), upgraded);
  assert.equal(restorePatch({ customPath: root }).success, true);
  assert.deepEqual(hashes(), upgraded);
  assert.equal(fs.existsSync(path.join(res, '.claude_chinese_meta.json')), false);

  assert.equal(applyPatch({ customPath: root }).success, true);
  writeVersion('4.4213.0');
  const latest = hashes();
  assert.equal(restorePatch({ customPath: root }).success, true);
  assert.deepEqual(hashes(), latest, 'Restore must not downgrade an official update');

  // One found PE hash cannot hide another missing PE hash, and failure writes nothing.
  const exe = path.join(root, 'claude.exe');
  const before = fs.readFileSync(exe);
  const invalid = patchClaudeExe(exe, { 'app.asar': 'a'.repeat(64), 'missing.asar': 'b'.repeat(64) });
  assert.equal(invalid.success, false);
  assert.deepEqual(fs.readFileSync(exe), before);

  // Invalid explicit paths must never fall through to the real installation.
  const missing = path.join(root, 'does-not-exist');
  assert.equal(getClaudeInstallation(missing).resourcesPath, null);
  assert.equal(applyPatch({ customPath: missing }).success, false);
  console.log('PASS: complete ASAR transaction, rollback, upgrade, restore, fallback and unpacked assets');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
