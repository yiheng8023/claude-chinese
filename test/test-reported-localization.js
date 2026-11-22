const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { patchJsFiles, packAsarSync, JS_LITERAL_PATCHES } = require('../core/patcher');
const { auditInferenceHelp, resolveFixtureDocuments } = require('../tools/audit-inference-help');
const zh = require('../dict/ion-zh-CN.json');
const translatedDocs = require('../dict/long-docs-zh-CN.json');
const fixture = require('./fixtures/inference-help-4.4212.json');
const currentFixture = require('./fixtures/inference-help-4.16336.json');
const latestFixture = require('./fixtures/inference-help-4.23118.json');
const v5Fixture = require('./fixtures/inference-help-5.1231.json');
const v5LatestFixture = require('./fixtures/inference-help-5.11492.json');
const v6Fixture = require('./fixtures/inference-help-6.6395.json');
const v628899Fixture = require('./fixtures/inference-help-6.28899.json');

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
  '9WSR22vPgm': '保存为环境', fs9XMzW72m: '删除所有会话',
  uXinBOnUV7: '计划', Q2QyZ42lOG: '移至会话下',
  '4bX1PIcQOm': '与界面一致', s6OueH6eJQ: '回复字体',
  'MzMg+gIepF': '默认 · {font}', ghSj3dz9nV: '系统',
  GzzPVMOYC7: '减少应用中的动效，或跟随系统设置。', wwA2NzN0nb: 'Unified Claude',
  Dbc6XaCcol: '定时任务', HN0DVKPD6z: '定时任务',
  ZTK8vIOPS5: '新建定时任务', 'nqu1699+6Q': '暂无定时任务。',
  '/2UegjsIBr': '总结和后续建议', 'biG+krWPOa': '搜索文件夹…',
  '3Wav1LT0EM': '无法使用 SSH。模型提供商的端点在此计算机上，远程主机无法访问。',
  J5MyIE7Qp5: '会话不会使用你为 {name} 设置的值。',
  'okFGaP/EGD': '部分会话未列出。要恢复其中一个，请在主机上的此文件夹中运行 <code>claude --resume</code>。',
  W90cZ2JcPO: '会话工具', dsFi2Ih7yW: '最近使用的文件夹',
  fz0z4cb6fQ: '套餐', 'P6EE/aQ7SS': 'Token 用量', ZON8uMn14w: '个 Token'
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
  assert.equal(resolveFixtureDocuments(fixture).length, 124);
  assert.equal(resolveFixtureDocuments(currentFixture).length, 129);
  assert.equal(resolveFixtureDocuments(latestFixture).length, 132);
  assert.equal(v5Fixture.helpReferences, 141);
  assert.equal(resolveFixtureDocuments(v5Fixture).length, 139);
  assert.equal(v5LatestFixture.helpReferences, 147);
  assert.equal(resolveFixtureDocuments(v5LatestFixture).length, 145);
  assert.equal(v6Fixture.helpReferences, 156);
  assert.equal(resolveFixtureDocuments(v6Fixture).length, 152);
  assert.equal(v628899Fixture.helpReferences, 184);
  assert.equal(resolveFixtureDocuments(v628899Fixture).length, 180);
  // Identical English labels can have different meanings in distinct components.
  assert.equal(zh['IG5n0mukdA'], '键');
  assert.equal(zh['EcglP9ZtIw'], '密钥');
  assert.equal(zh['UAxIHLpY5k'], '进行中');
  assert.equal(zh['Dn82ALx/+V'], '实时');
  assert.equal(zh['IxbsWX4wj4'], '添加标头');
  assert.equal(zh['79IWiafC91'], '标头');
  assert.equal(zh['vUjsX7qaCx'], '页眉');
  for (const english of new Set([fixture, currentFixture, latestFixture, v5Fixture, v5LatestFixture, v6Fixture, v628899Fixture].flatMap(resolveFixtureDocuments))) {
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
  console.log('PASS: scoped labels and reviewed 4.x–6.x inference help render Chinese with code and links preserved');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
