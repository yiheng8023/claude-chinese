const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

const phrasesToFind = [
  'Import & export',
  'Import isn’t enabled',
  'Import isn\'t enabled',
  'Add skills to extend',
  'Provided by',
  'Connects in sessions',
  'Connects in',
  'deployment. Contact your organization'
];

console.log('=== 查找截图中的漏翻词条 ===\n');

for (const p of phrasesToFind) {
  console.log(`--- 搜索: "${p}" ---`);
  for (const [k, v] of Object.entries(backup)) {
    if (v.toLowerCase().includes(p.toLowerCase())) {
      console.log(`Key: [${k}]`);
      console.log(`  EN: "${v}"`);
      console.log(`  ZH: "${ionZh[k] || '[MISSING]'}"\n`);
    }
  }
}
