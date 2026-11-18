const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = require('../assist/windows/build-profile.cjs');
const { prepareCompanion } = require('../assist/windows/start.cjs');

assert.equal(profile.Capabilities, '功能');
assert.equal(profile['Does not cover web search, model requests or MCP servers.'], '不涵盖网页搜索、模型请求或 MCP 服务器。');
assert.match(profile['Entries: a hostname, a wildcard (*.corp.com, subdomains only) or * for all.'], /\*\.corp\.com/);
assert.equal(profile['What is this'], undefined, 'User-authored session title is outside the configuration profile');
if (process.platform === 'win32' && process.arch === 'x64') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-cn-assist-'));
  try {
    const exe = prepareCompanion(root);
    assert.equal(prepareCompanion(root), exe, 'Same source and profile reuse the compiled companion');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(path.dirname(exe), 'inference-profile.json'))), profile);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
console.log('PASS: contextual configuration help profile and Windows companion build');
