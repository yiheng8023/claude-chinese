const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const cli = path.join(__dirname, '..', 'cli.js');
for (const args of [
  ['install', '--path'],
  ['install', '--path', path.join(__dirname, 'missing-installation')],
  ['launch', '--path', path.join(__dirname, 'missing-installation')],
  ['restore', '--path', path.join(__dirname, 'missing-installation')],
  ['repair', '--path', path.join(__dirname, 'missing-installation')],
  ['shortcut'],
  ['shortcut', '--output', path.join(__dirname, 'not-a-shortcut.txt')]
]) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_NO_KILL: '1' } });
  assert.notEqual(result.status, 0, `Invalid explicit target must fail: ${args.join(' ')}`);
}
const scripts = require('../package.json').scripts;
assert.equal(scripts.install, undefined, 'Installing npm dependencies must not patch a real client');
console.log('PASS: CLI failures report nonzero status and npm install does not patch the client');

if (process.platform === 'win32') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-registered-launch-'));
  try {
    const resourcesPath = path.join(root, 'app', 'resources');
    const source = path.join(root, 'source');
    fs.mkdirSync(resourcesPath, { recursive: true });
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'index.js'), 'module.exports = 1;');
    const { packAsarSync, getRawHeaderSha256 } = require('../core/patcher');
    for (const file of ['app.asar', 'ion-dist.asar']) packAsarSync(source, path.join(resourcesPath, file));
    const exe = path.join(root, 'app', 'claude.exe');
    const exeBytes = ['app.asar', 'ion-dist.asar'].map(file => JSON.stringify({ file, alg:'SHA256', value:getRawHeaderSha256(path.join(resourcesPath, file)) })).join('\n');
    fs.writeFileSync(exe, exeBytes);
    const marker = path.join(root, 'launched.txt');
    const preload = path.join(root, 'preload.cjs');
    const modulePath = file => JSON.stringify(path.join(__dirname, '..', 'core', file));
    fs.writeFileSync(preload, `
const fs = require('node:fs');
const info = ${JSON.stringify({platform:'win32', type:'msix', installPath:root, resourcesPath, packageFamilyName:'Claude_pzs8sxrjxfjjc', isPatched:false})};
if (process.env.CLAUDE_TEST_ALREADY_PATCHED) { info.isPatched = true; info.needsUpdate = false; }
if (process.env.CLAUDE_TEST_LOOSE) { info.type = 'win32'; info.resourcesPath = ${JSON.stringify(path.join(root,'loose-resources'))}; }
if (process.env.CLAUDE_TEST_STORE) { info.packageFamilyName = 'AnthropicPBC.Claude_fnn82j28hfe8t'; info.distribution = 'store'; }
const recovered = {...info, installPath: ${JSON.stringify(path.join(root, 'recovered'))}, version: '6.6395.0.0'};
let current = info;
require(${modulePath('msix-detector.js')}).getClaudeInstallation = () => current;
const permissions = require(${modulePath('permissions.js')});
permissions.canWriteDirectory = () => {
  if (!process.env.CLAUDE_TEST_LOOSE) throw Error('Registered package must not receive write probes');
  return false;
};
permissions.grantPermissions = () => { throw Error('Launch must not request UAC'); };
permissions.sanitizePermissions = () => { throw Error('Denied launch must not modify ACL'); };
const patcher = require(${modulePath('patcher.js')});
patcher.isClaudeRunning = () => { throw Error('Registered paths must not inspect or close processes'); };
if (process.env.CLAUDE_TEST_FORBID_PATCH) patcher.applyPatch = () => { throw Error('Unexpected localization write'); };
require(${modulePath('windows-package.js')}).recoverPendingUpdate = () => {
  if (process.env.CLAUDE_TEST_RECOVERY_FAILURE) throw Error('fixture official recovery failure');
  if (process.env.CLAUDE_TEST_RECOVER) current = recovered;
  return current;
};
require('node:child_process').execSync = command => fs.writeFileSync(${JSON.stringify(marker)}, command);
`);
    const run = (extraEnv, command = 'launch') => spawnSync(process.execPath, ['--require', preload, cli, command], {
      encoding:'utf8', env:{...process.env, LOCALAPPDATA:path.join(root,'local'), CLAUDE_NO_KILL:'1', ...extraEnv}
    });
    const allowed = run({CLAUDE_TEST_FORBID_PATCH:'1', CLAUDE_TEST_RECOVERY_FAILURE:'1'});
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.match(fs.readFileSync(marker, 'utf8'), /AppsFolder\\Claude_pzs8sxrjxfjjc!Claude/);
    fs.unlinkSync(marker);
    for (const command of ['check', 'install', 'restore', 'watch']) {
      const denied = run({}, command);
      assert.notEqual(denied.status, 0, command);
      assert.match(denied.stderr + denied.stdout, /注册包由系统管理/, command);
    }
    const apiGuard = spawnSync(process.execPath, ['--require',preload,'-e',
      `const p=require(${modulePath('patcher.js')}); const a=require('node:assert/strict');
      for (const method of ['applyPatch','restorePatch']) a.equal(p[method]({autoClose:true}).code,'PROTECTED_INSTALLATION');`],
      {encoding:'utf8',env:{...process.env,LOCALAPPDATA:path.join(root,'local')}});
    assert.equal(apiGuard.status, 0, apiGuard.stderr);
    const pointer = path.join(resourcesPath, '.claude_chinese_transaction.json');
    fs.writeFileSync(pointer, '{}');
    assert.notEqual(run().status, 0, 'A pending transaction must stop the toolkit launch');
    assert(!fs.existsSync(marker));
    const alreadyPatched = run({CLAUDE_TEST_ALREADY_PATCHED:'1'});
    assert.notEqual(alreadyPatched.status, 0, 'An already-patched client must still stop for a pending transaction');
    assert.match(alreadyPatched.stderr, /未完成的汉化事务/);
    assert(!fs.existsSync(marker));
    fs.unlinkSync(pointer);
    fs.writeFileSync(exe, exeBytes.replace(/"value":"[a-f0-9]{64}"/, '"value":"'+'0'.repeat(64)+'"'));
    assert.notEqual(run().status, 0, 'Integrity mismatch must stop the toolkit launch');
    assert(!fs.existsSync(marker));
    fs.writeFileSync(exe, exeBytes);
    const ion = path.join(resourcesPath, 'ion-dist.asar');
    const intact = fs.readFileSync(ion);
    fs.writeFileSync(ion, '');
    assert.notEqual(run({CLAUDE_TEST_RECOVER:'1'}).status, 0, 'Launch must leave registration recovery to repair');
    assert(!fs.existsSync(marker));
    fs.writeFileSync(ion, intact);
    const recoveredEnv = { CLAUDE_TEST_RECOVER:'1', CLAUDE_TEST_FORBID_PATCH:'1' };
    const repair = run(recoveredEnv, 'repair');
    assert.equal(repair.status, 0, repair.stderr);
    assert.match(repair.stdout, /6\.6395\.0\.0/);
    assert(!fs.existsSync(marker), 'Explicit repair must leave application startup to the user');
    assert.notEqual(run({CLAUDE_TEST_RECOVERY_FAILURE:'1'}, 'repair').status, 0);
    assert.notEqual(run({CLAUDE_TEST_STORE:'1'}, 'repair').status, 0, 'Store installs use the official Store repair path');
    assert(!fs.existsSync(marker));
    fs.renameSync(exe, exe + '.missing');
    assert.notEqual(run(recoveredEnv, 'repair').status, 0, 'Missing executable must not be reported as healthy');
    assert.notEqual(run(recoveredEnv).status, 0, 'The toolkit launch still requires a main executable');
    assert(!fs.existsSync(marker));
    fs.renameSync(exe + '.missing', exe);
    fs.mkdirSync(path.join(root,'loose-resources'));
    const loose = spawnSync(process.execPath, ['--require',preload,'-e',
      `const result=require(${modulePath('patcher.js')}).applyPatch({customPath:'fixture',allowElevation:false});require('node:assert/strict').equal(result.code,'WRITE_PERMISSION_REQUIRED',result.error);`],
      {encoding:'utf8',env:{...process.env,LOCALAPPDATA:path.join(root,'local'),CLAUDE_TEST_LOOSE:'1'}});
    assert.equal(loose.status, 0, loose.stderr);
    const protectedDir = path.join(root, 'WindowsApps', 'fixture');
    fs.mkdirSync(protectedDir, {recursive:true});
    fs.copyFileSync(ion, path.join(protectedDir, 'ion-dist.asar'));
    const junction = path.join(root, 'alias');
    fs.symlinkSync(protectedDir, junction, 'junction');
    const alias = spawnSync(process.execPath, [cli,'install','--path',junction], {encoding:'utf8'});
    assert.notEqual(alias.status, 0);
    assert.match(alias.stdout, /注册包由系统管理/);
    fs.unlinkSync(junction);
    const linked = path.join(root, 'hard-linked-copy');
    fs.mkdirSync(linked);
    fs.linkSync(ion, path.join(linked, 'ion-dist.asar'));
    const linkedInstall = spawnSync(process.execPath, [cli,'install','--path',linked], {encoding:'utf8'});
    assert.notEqual(linkedInstall.status, 0);
    assert.match(linkedInstall.stdout, /逐文件复制的独立测试副本/);
    console.log('PASS: Windows recovery leaves localization separate and verifies the registered client before startup');
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
}
