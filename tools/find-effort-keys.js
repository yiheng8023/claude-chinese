const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('=== 搜索 Effort / 推理强度 / You’re here! / context window 相关词条 ===\n');

const searchTerms = [
  'Effort',
  'You’re here',
  'You\'re here',
  'context window',
  'Higher effort means',
  'effort means more detailed'
];

for (const term of searchTerms) {
  console.log(`--- 搜索: "${term}" ---`);
  for (const [k, v] of Object.entries(backup)) {
    if (v.toLowerCase().includes(term.toLowerCase()) || v === term) {
      console.log(`Key: [${k}] EN: "${v}" -> ZH: "${ionZh[k] || '[MISSING]'}"`);
    }
  }
}
