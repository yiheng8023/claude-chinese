const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('=== 扫描设置、技能、插件、连接器相关的全部缺失词条 ===\n');

const settingsKeywords = [
  'connector',
  'plugin',
  'skill',
  'export',
  'import',
  'developer',
  'desktop app',
  'appearance',
  'privacy',
  'billing',
  'custom connector',
  'plugin directory',
  'installed plugin',
  'managed settings'
];

const missingEntries = [];

for (const [k, v] of Object.entries(backup)) {
  if (!ionZh[k]) {
    const vLower = v.toLowerCase();
    for (const kw of settingsKeywords) {
      if (vLower.includes(kw)) {
        missingEntries.push({ key: k, en: v });
        break;
      }
    }
  }
}

console.log(`共发现 ${missingEntries.length} 条设置/插件/技能相关缺失词条：\n`);
missingEntries.forEach(item => {
  console.log(`[${item.key}] EN: "${item.en.replace(/\n/g, ' ')}"`);
});
