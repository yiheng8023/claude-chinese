const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { hashFile, replaceFile } = require('../core/file-replacement');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-replacement-'));
const source = path.join(root, 'source');
const target = path.join(root, '目标 😀');
try {
  fs.writeFileSync(source, 'complete replacement');
  fs.writeFileSync(target, 'original target');
  const originalHash = hashFile(target);
  const copy = fs.copyFileSync;
  fs.copyFileSync = (from, to, ...options) => {
    if (to.endsWith('.new')) {
      fs.writeFileSync(to, 'incomplete');
      throw new Error('copy interrupted');
    }
    return copy(from, to, ...options);
  };
  try { assert.throws(() => replaceFile(source, target), /copy interrupted/); }
  finally { fs.copyFileSync = copy; }
  assert.equal(hashFile(target), originalHash, 'A failed temporary copy must preserve the target');
  assert.equal(fs.readdirSync(root).length, 2, 'Failed staging removes only its temporary file');

  if (process.platform === 'win32') {
    fs.chmodSync(target, 0o444);
    try {
      assert.throws(() => replaceFile(source, target), /文件替换失败/);
      assert.equal(hashFile(target), originalHash, 'A refused replacement preserves the target');
    } finally { fs.chmodSync(target, 0o666); }

    const securityScript = [
      "$env:PSModulePath=Join-Path $PSHOME 'Modules'",
      '[Console]::InputEncoding=New-Object System.Text.UTF8Encoding',
      '[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding',
      '$r=[Console]::In.ReadToEnd() | ConvertFrom-Json',
      '$acl=[IO.File]::GetAccessControl($r.target)',
      'if($r.protect){$acl.SetAccessRuleProtection($true,$true);[IO.File]::SetAccessControl($r.target,$acl)}',
      '[IO.File]::GetAccessControl($r.target).Sddl'
    ].join('\n');
    const security = protect => {
      const result = spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command',securityScript], {
        input: JSON.stringify({target, protect}), encoding:'utf8', windowsHide:true
      });
      assert.equal(result.status, 0, 'Test ACL operation failed');
      return result.stdout.trim();
    };
    const protectedDacl = security(true);
    replaceFile(source, target);
    assert(security(false) === protectedDacl, 'Windows replacement must preserve the original DACL');
  } else {
    fs.chmodSync(target, 0o640);
    replaceFile(source, target);
    assert.equal(fs.statSync(target).mode & 0o777, 0o640);
  }
  assert.equal(hashFile(target), hashFile(source));
  assert.equal(fs.readdirSync(root).length, 2);
  console.log('PASS: incomplete staging and replacement denial preserve target bytes; successful replacement preserves access permissions');
} finally {
  if (fs.existsSync(target)) fs.chmodSync(target, 0o666);
  fs.rmSync(root, {recursive:true, force:true});
}
