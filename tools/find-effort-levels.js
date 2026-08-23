const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const ionEn = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.json', 'utf8'));

console.log('=== 查找推理强度档位词条 ===\n');

for (const [k, v] of Object.entries(ionEn)) {
  if (
    v === 'Low' ||
    v === 'Medium' ||
    v === 'High' ||
    v === 'Extra high' ||
    v === 'Extra High' ||
    v === 'Extra' ||
    v === 'Max' ||
    v === 'Maximum' ||
    v.includes('takes longer') ||
    v.includes('detailed answers') ||
    v.includes('Higher effort') ||
    v.includes('effort means') ||
    v.includes('detailed responses')
  ) {
    console.log(`Key: [${k}]`);
    console.log(`  EN: "${v}"`);
    console.log(`  ZH: "${ionZh[k] || '[MISSING]'}"\n`);
  }
}
