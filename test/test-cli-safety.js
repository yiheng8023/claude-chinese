const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cli = path.join(__dirname, '..', 'cli.js');
for (const args of [
  ['install', '--path'],
  ['install', '--path', path.join(__dirname, 'missing-installation')],
  ['launch', '--path', path.join(__dirname, 'missing-installation')],
  ['restore', '--path', path.join(__dirname, 'missing-installation')]
]) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_NO_KILL: '1' } });
  assert.notEqual(result.status, 0, `Invalid explicit target must fail: ${args.join(' ')}`);
}
const scripts = require('../package.json').scripts;
assert.equal(scripts.install, undefined, 'Installing npm dependencies must not patch a real client');
console.log('PASS: CLI failures report nonzero status and npm install does not patch the client');
