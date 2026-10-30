const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { patchJsFiles, packAsarSync, JS_LITERAL_PATCHES } = require('../core/patcher');
const { auditInferenceHelp } = require('../tools/audit-inference-help');
const zh = require('../dict/ion-zh-CN.json');
const translatedDocs = require('../dict/long-docs-zh-CN.json');
const fixture = require('./fixtures/inference-help-4.4212.json');

function protectedParts(text) {
  const blocks = [...text.matchAll(/```[^\n]*\n[\s\S]*?```/g)].map(m => m[0]);
  const rest = text.replace(/```[^\n]*\n[\s\S]*?```/g, '');
  return {
    blocks: blocks.sort(),
    code: [...rest.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)].map(m => m[1]).sort(),
    links: [...text.matchAll(/\]\(([^\s)]+)\)/g)].map(m => m[1]).sort()
  };
}

const labels = { DajEsL0bgK: '文件树位置', MmisWi8T3N: '在文件树中选择一个文件。', yKiRiVmLd5: '自动', DbN79DWvpd: '左侧', UfWUHzL0CF: '右侧', HIc5BpkJZP: '新建会话' };
for (const [id, text] of Object.entries(labels)) assert.equal(zh[id], text, `Reported UI label ${id}`);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-help-render-'));
assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
try {
  // Exact current schema helper; body fixtures include constants, interpolation,
  // and the three generated OIDC variants, not only formatMessage IDs.
  fs.writeFileSync(path.join(root, 'factory.js'), 'function _(e,t){return{text:e,...t}};globalThis.doc=_;');
  const result = patchJsFiles(root, Object.fromEntries(JS_LITERAL_PATCHES.map(p => [p.id, 0])));
  assert.equal(result.error, null);
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'factory.js'), 'utf8'), context);
  assert.equal(fixture.documents.length, 124);
  for (const english of fixture.documents) {
    assert(Object.hasOwn(translatedDocs, english), `Missing complete help body: ${english.split('\n')[0]}`);
    const translated = translatedDocs[english];
    assert(/\p{Script=Han}/u.test(translated), 'Help prose must be translated');
    assert(!/\*\*[^*\n]*[：。，；！？]\*\*(?=[\p{L}\p{N}])/u.test(translated), 'Punctuation at the end of bold Chinese labels needs a following space to render emphasis');
    assert.deepEqual(protectedParts(translated), protectedParts(english), 'Code examples, configuration keys and documentation links must survive translation');
    const rendered = context.doc(english, { docsUrl: 'https://example.test/docs' });
    assert.equal(rendered.text, translated, 'Expanded help must render the complete current translation');
    assert.equal(rendered.docsUrl, 'https://example.test/docs');
  }
  const changedSource = path.join(root, 'changed-upstream');
  const resources = path.join(root, 'client', 'resources');
  const schema = path.join(changedSource, ...fixture.sourceFiles[0].file.split('/'));
  fs.mkdirSync(path.dirname(schema), { recursive: true });
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(schema, '// Upstream help changed after the recorded review.\n');
  packAsarSync(changedSource, path.join(resources, 'ion-dist.asar'));
  assert.throws(() => auditInferenceHelp({ resourcesPath: resources, version: '4.4213.0' }), /源码.*不一致/, 'Changed installed help must require a new review instead of passing an old snapshot');
  console.log('PASS: reported file-tree labels and all 124 current inference help bodies render Chinese with code and links preserved');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
