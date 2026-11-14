const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const acorn = require('acorn');
const { patchJsFiles, JS_LITERAL_PATCHES } = require('../core/patcher');
const records = require('../dict/scoped-ui-zh-CN.json');
const { scopedUiPatches } = require('../core/scoped-ui');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-scoped-ui-'));
try {
  for (const [index, record] of records.entries()) {
    const dir = path.join(root, String(index)); fs.mkdirSync(dir);
    const file = path.join(dir, path.posix.basename(record.file));
    const before = /^(?:[\w$]+)=/.test(record.before)
      ? `const ${record.before};`
      : `const preset={${record.before}};`;
    const source = `${before}\nconst authored=${JSON.stringify(record.english)};`;
    fs.writeFileSync(file, source);
    fs.writeFileSync(path.join(dir, 'unrelated.js'), source);
    const hits = Object.fromEntries(JS_LITERAL_PATCHES.map(p => [p.id, 0]));
    const result = patchJsFiles(dir, hits, { isAsarMode: true });
    assert.equal(result.error, null);
    const translated = fs.readFileSync(file, 'utf8');
    assert(translated.includes(record.after), record.english);
    assert(translated.includes(`const authored=${JSON.stringify(record.english)};`), 'Runtime/user string remains unchanged');
    assert.equal(fs.readFileSync(path.join(dir, 'unrelated.js'), 'utf8'), source, 'Same literal in another module remains unchanged');
    acorn.parse(translated, { ecmaVersion: 'latest', sourceType: 'module' });
    patchJsFiles(dir, hits, { isAsarMode: true });
    assert.equal(fs.readFileSync(file, 'utf8'), translated, 'Idempotent scoped patch');
    const patch = scopedUiPatches[index];
    assert.equal(translated.replace(patch.zhPattern, patch.restoreEn), source, 'Fallback restore returns the exact original source');
  }
  console.log(`PASS: ${records.length} scoped UI patches preserve unrelated modules and authored values, parse, repeat and restore`);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
