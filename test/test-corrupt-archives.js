const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runPreflightCheck } = require('../core/preflight');
const { applyPatch } = require('../core/patcher');
const { spawnSync } = require('node:child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-empty-archives-'));
const resources = path.join(root, 'resources');
fs.mkdirSync(resources);
try {
  fs.writeFileSync(path.join(root, 'claude.exe'), 'fixture executable');
  for (const name of ['app.asar', 'ion-dist.asar']) {
    fs.writeFileSync(path.join(resources, name), '');
    fs.writeFileSync(path.join(resources, name + '.orig.bak'), 'preserved original backup');
  }
  const before = fs.readdirSync(resources).map(name => [name, fs.readFileSync(path.join(resources, name))]);
  const status = spawnSync(process.execPath, [path.join(__dirname, '../cli.js'), 'status', '--path', root], {encoding:'utf8'});
  assert.notEqual(status.status, 0, 'Status must not describe a damaged client as a normal English installation');
  assert.match(status.stdout + status.stderr, /0 字节.*官网完整安装包/);
  const preflight = runPreflightCheck({ customPath: root, autoClose: false });
  const health = preflight.checks.find(check => check.id === 'client-archives');
  assert.equal(health?.passed, false, 'Preflight must reject empty client archives');
  assert.match(health.detail, /0 字节.*官网完整安装包/);
  assert.equal(preflight.allPassed, false);
  const result = applyPatch({ customPath: root, autoClose: false });
  assert.equal(result.success, false);
  assert.match(result.error, /0 字节.*官网完整安装包/);
  assert.deepEqual(fs.readdirSync(resources).map(name => [name, fs.readFileSync(path.join(resources, name))]), before,
    'Corruption detection must not replace current files or original backups');
  fs.writeFileSync(path.join(resources, 'app.asar'), 'not an ASAR header');
  const malformed = runPreflightCheck({ customPath: root, autoClose: false }).checks.find(check => check.id === 'client-archives');
  assert.equal(malformed.passed, false);
  assert.match(malformed.detail, /归档头不可读.*官网完整安装包/);
  console.log('PASS: empty archives stop preflight/install with a repair hint and preserve backups');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
