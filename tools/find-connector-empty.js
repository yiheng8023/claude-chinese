const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('=== 查找连接器空白态引导词条 ===\n');

for (const [k, v] of Object.entries(backup)) {
  if (
    v.toLowerCase().includes('unlock more with claude') ||
    v.toLowerCase().includes('connect your team') ||
    v.toLowerCase().includes('when you connect your')
  ) {
    console.log(`Key: [${k}]`);
    console.log(`  EN: "${v}"`);
    console.log(`  ZH: "${ionZh[k] || '[MISSING]'}"\n`);
  }
}
