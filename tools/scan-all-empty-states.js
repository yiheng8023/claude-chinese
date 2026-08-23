const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('=== 全量扫描所有空白态、引导及带 <link> 的缺失词条 ===\n');

const missingLinkEntries = [];

for (const [k, v] of Object.entries(backup)) {
  if (!ionZh[k]) {
    if (
      v.includes('Learn more') ||
      v.includes('Unlock') ||
      v.includes('No ') ||
      v.includes('Get started') ||
      v.includes('Try ') ||
      v.includes('Browse ')
    ) {
      missingLinkEntries.push({ key: k, en: v });
    }
  }
}

console.log(`共发现 ${missingLinkEntries.length} 条引导/空白态缺失词条：\n`);
missingLinkEntries.slice(0, 30).forEach(item => {
  console.log(`[${item.key}] EN: "${item.en.replace(/\n/g, ' ')}"`);
});
