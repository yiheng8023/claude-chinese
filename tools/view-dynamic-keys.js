const fs = require('fs');
const path = require('path');

const dynZhPath = path.join(__dirname, '../dict/dynamic-zh-CN.json');
const dynZh = JSON.parse(fs.readFileSync(dynZhPath, 'utf8'));
const dynEn = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/dynamic/en-US.json', 'utf8'));

console.log('=== Dynamic i18n entries ===');
for (const [k, v] of Object.entries(dynEn)) {
  console.log(`[${k}]`);
  console.log(`  EN: "${v}"`);
  console.log(`  ZH: "${dynZh[k]}"\n`);
}
