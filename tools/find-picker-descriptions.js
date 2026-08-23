const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('=== 查找模型选择器卡片子文本 ===');

for (const [k, v] of Object.entries(backup)) {
  if (
    v.includes('context window') ||
    v.includes('Context window') ||
    v.includes('handles complex') ||
    v.includes('fastest') ||
    v.includes('daily tasks') ||
    v.includes('deepest model')
  ) {
    console.log(`Key: [${k}]`);
    console.log(`  EN: "${v}"`);
    console.log(`  ZH: "${ionZh[k] || '[MISSING]'}"\n`);
  }
}
