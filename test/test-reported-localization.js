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
const currentFixture = require('./fixtures/inference-help-4.16336.json');
const latestFixture = require('./fixtures/inference-help-4.23118.json');

function protectedParts(text) {
  const blocks = [...text.matchAll(/```[^\n]*\n[\s\S]*?```/g)].map(m => m[0]);
  const rest = text.replace(/```[^\n]*\n[\s\S]*?```/g, '');
  return {
    blocks: blocks.sort(),
    code: [...rest.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)].map(m => m[1]).sort(),
    links: [...text.matchAll(/\]\(([^\s)]+)\)/g)].map(m => m[1]).sort()
  };
}

const labels = {
  DajEsL0bgK: '文件树位置', MmisWi8T3N: '在文件树中选择一个文件。', yKiRiVmLd5: '自动',
  DbN79DWvpd: '左侧', UfWUHzL0CF: '右侧', HIc5BpkJZP: '新建会话',
  IYqnbutkNe: '定时任务仅在电脑处于唤醒状态并联网时运行。',
  PC56sEVf9Z: '在日历中的每场会议前提供简短资料，涵盖与会者、背景和议程。',
  Jff654lhcV: '折叠所有文件夹', KR30GhQ0bY: '制表符宽度',
  'SM/PSyq5fS': '没有已展开的文件夹可供折叠。', '42YfXqKAm8': '新建侧边会话',
  '65lRW0A2LM': '问个简单问题', myljfhoK3X: '选择环境',
  '8DbsasU3Hw': '跳转到行', PTtw6MZuiL: '创建分区',
  '9WSR22vPgm': '保存为环境', fs9XMzW72m: '删除所有会话'
};
for (const [id, text] of Object.entries(labels)) assert.equal(zh[id], text, `Reported UI label ${id}`);
const menuBadge = JS_LITERAL_PATCHES.find(patch => patch.id === 'effort-menu-recommended-badge');
assert.equal(menuBadge.intlLayer, 'dynamic');
assert.equal(require('../dict/dynamic-zh-CN.json')[menuBadge.intlKey], '推荐', 'The new native dynamic badge must have its translation');

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
  assert.equal(currentFixture.documents.length, 129);
  assert.equal(latestFixture.documents.length, 132);
  for (const english of new Set([...fixture.documents, ...currentFixture.documents, ...latestFixture.documents])) {
    assert(Object.hasOwn(translatedDocs, english), `Missing complete help body: ${english.split('\n')[0]}`);
    const translated = translatedDocs[english];
    assert(/\p{Script=Han}/u.test(translated), 'Help prose must be translated');
    assert(!/\*\*[^*\n]*[：。，；！？]\*\*(?=[\p{L}\p{N}])/u.test(translated), 'Punctuation at the end of bold Chinese labels needs a following space to render emphasis');
    assert(!/`[^`\n]+`[、，]`[^`\n]+`/u.test(translated), 'Code lists need separating whitespace so the help panel can wrap them');
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
  console.log('PASS: reported labels and reviewed 4.4212/4.16336/4.23118 inference help render Chinese with code and links preserved');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
