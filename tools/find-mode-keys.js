const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('--- 搜索模式相关词条 ---');

for (const [k, v] of Object.entries(backup)) {
  if (
    v === 'Manual' ||
    v === 'Plan' ||
    v === 'Running' ||
    v.includes('Always ask before making changes') ||
    v.includes('Automatically accept all file edits') ||
    v.includes('Create a plan before making changes') ||
    v.includes('Accept edits') ||
    v.includes('accept all file edits')
  ) {
    console.log(`Key: [${k}] EN: "${v}" -> ZH: "${ionZh[k] || '[MISSING]'}"`);
  }
}
