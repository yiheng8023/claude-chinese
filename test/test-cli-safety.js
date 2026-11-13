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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-launch-permission-'));
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
require(${modulePath('msix-detector.js')}).getClaudeInstallation = () => info;
const permissions = require(${modulePath('permissions.js')});
permissions.canWriteDirectory = () => false;
permissions.grantPermissions = () => { throw Error('Launch must not request UAC'); };
permissions.sanitizePermissions = () => { throw Error('Denied launch must not modify ACL'); };
const patcher = require(${modulePath('patcher.js')});
patcher.isClaudeRunning = () => false;
const applyFixturePatch = patcher.applyPatch;
patcher.applyPatch = options => applyFixturePatch({...options, customPath:'fixture'});
if (process.env.CLAUDE_TEST_PATCH_FAILURE) patcher.applyPatch = () => ({success:false,error:'fixture general patch failure'});
require(${modulePath('windows-package.js')}).recoverPendingUpdate = input => input;
require('node:child_process').execSync = command => fs.writeFileSync(${JSON.stringify(marker)}, command);
`);
    const run = extraEnv => spawnSync(process.execPath, ['--require', preload, cli, 'launch'], {
      encoding:'utf8', env:{...process.env, LOCALAPPDATA:path.join(root,'local'), CLAUDE_NO_KILL:'1', ...extraEnv}
    });
    const allowed = run();
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.match(allowed.stderr, /本次未更新汉化/);
    assert.match(fs.readFileSync(marker, 'utf8'), /AppsFolder\\Claude_pzs8sxrjxfjjc!Claude/);
    fs.unlinkSync(marker);
    const pointer = path.join(resourcesPath, '.claude_chinese_transaction.json');
    fs.writeFileSync(pointer, '{}');
    assert.notEqual(run().status, 0, 'A pending transaction must stop permission fallback');
    assert(!fs.existsSync(marker));
    const alreadyPatched = run({CLAUDE_TEST_ALREADY_PATCHED:'1'});
    assert.notEqual(alreadyPatched.status, 0, 'An already-patched client must still stop for a pending transaction');
    assert.match(alreadyPatched.stderr, /未完成的汉化事务/);
    assert(!fs.existsSync(marker));
    fs.unlinkSync(pointer);
    fs.writeFileSync(exe, exeBytes.replace(/"value":"[a-f0-9]{64}"/, '"value":"'+'0'.repeat(64)+'"'));
    assert.notEqual(run().status, 0, 'Integrity mismatch must stop permission fallback');
    assert(!fs.existsSync(marker));
    fs.writeFileSync(exe, exeBytes);
    const ion = path.join(resourcesPath, 'ion-dist.asar');
    const intact = fs.readFileSync(ion);
    fs.writeFileSync(ion, '');
    assert.notEqual(run().status, 0, 'Unreadable archives must stop permission fallback');
    assert(!fs.existsSync(marker));
    fs.writeFileSync(ion, intact);
    assert.notEqual(run({CLAUDE_TEST_PATCH_FAILURE:'1'}).status, 0, 'General patch errors must still stop startup');
    assert(!fs.existsSync(marker));
    fs.mkdirSync(path.join(root,'loose-resources'));
    const loose = spawnSync(process.execPath, ['--require',preload,'-e',
      `const result=require(${modulePath('patcher.js')}).applyPatch({customPath:'fixture',allowElevation:false});require('node:assert/strict').equal(result.code,'WRITE_PERMISSION_REQUIRED',result.error);`],
      {encoding:'utf8',env:{...process.env,LOCALAPPDATA:path.join(root,'local'),CLAUDE_TEST_LOOSE:'1'}});
    assert.equal(loose.status, 0, loose.stderr);
    console.log('PASS: write denial opens only an intact client without UAC; corruption, incomplete transactions and general patch errors stop startup');
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
}
