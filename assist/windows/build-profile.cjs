const previous = require('../../test/fixtures/desktop-ui-5.11492.json');
const current = require('../../test/fixtures/desktop-ui-6.6395.json');
const help = require('../../test/fixtures/inference-help-6.6395.json');
const docs = require('../../dict/long-docs-zh-CN.json');
const zh = require('../../dict/ion-zh-CN.json');
const crypto = require('node:crypto');

const ids = new Set(current.sourceFiles
  .filter(record => /\/c(?:04850347|8dbdda48|9de94b11|e459c687)-/.test(record.file))
  .flatMap(record => record.ids));
const source = { ...previous.messages, ...current.messages };
const choices = new Map();
function add(english, chinese) {
  if (!english || !chinese || english === chinese || !/\p{Script=Han}/u.test(chinese)) return;
  if (!choices.has(english)) choices.set(english, new Set());
  choices.get(english).add(chinese);
}
for (const id of ids) {
  const english = source[id]?.english;
  if (english && !/[{}<>\n]/.test(english)) add(english, zh[id]);
}

const plain = text => text.trim().replace(/^[-*] /, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replaceAll('`', '').replaceAll('**', '').replace(/\s+/g, ' ');
const documentHashes = new Set(help.documentHashes);
const segments = text => text.split(/\n+/).filter(line => line.trim());
const protectedParts = text => [
  /^\s*[-*] /.test(text),
  [...text.matchAll(/`([^`]+)`/g)].map(match => match[1]).sort(),
  [...text.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]).sort()
];
for (const [english, chinese] of Object.entries(docs)) {
  if (!documentHashes.has(crypto.createHash('sha256').update(english).digest('hex'))) continue;
  const left = segments(english), right = segments(chinese);
  if (left.length !== right.length) continue;
  for (const [index, part] of left.entries()) {
    if (part.length >= 42 && JSON.stringify(protectedParts(part)) === JSON.stringify(protectedParts(right[index]))) {
      add(plain(part), plain(right[index]));
    }
  }
}

const profile = Object.fromEntries([...choices].filter(([, values]) => values.size === 1)
  .map(([english, values]) => [english, [...values][0]]));
Object.assign(profile, {
  'Configure third-party inference': '配置第三方推理',
  Connection: '连接',
  Capabilities: '功能',
  Connectors: '连接器',
  'Telemetry & updates': '遥测与更新',
  Limits: '配额与限制',
  Appearance: '外观',
  Plugins: '插件',
  Egress: '网络出口',
  Source: '来源',
  Export: '导出',
  'Apply Changes': '应用更改',
  'Learn more': '了解更多',
  'Hide details': '隐藏详情'
});
module.exports = profile;
