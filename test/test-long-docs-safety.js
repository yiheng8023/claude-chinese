const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { patchJsFiles, JS_LITERAL_PATCHES } = require('../core/patcher');
const docs = require('../dict/long-docs-zh-CN.json');
const [english, translated] = Object.entries(docs).find(([text]) => text.length > 30);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-doc-safety-'));
try {
  fs.writeFileSync(path.join(root, 'bundle.js'), 'function doc(text,extra){return{text:text,...extra}};globalThis.doc=doc;');
  const result = patchJsFiles(root, Object.fromEntries(JS_LITERAL_PATCHES.map(p => [p.id, 0])));
  assert.equal(result.error, null);
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'bundle.js'), 'utf8'), context);
  assert.equal(context.doc(english, {}).text, translated);
  const suffix = '\nNEW SAFETY REQUIREMENT: keep this warning.';
  assert.equal(context.doc(english + suffix, {}).text, translated + suffix, 'Partial translation must retain all unmatched source text');
  for (const text of ['constructor', 'toString', '__proto__']) assert.equal(context.doc(text, {}).text, text);
  console.log('PASS: long-document lookup preserves added warnings and ignores prototype properties');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
