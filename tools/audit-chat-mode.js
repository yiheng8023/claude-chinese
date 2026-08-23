/**
 * 审查 Chat 模式专属词条的汉化覆盖情况
 */
const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

const chatKeywords = [
  'Start a new chat',
  'Recent chats',
  'Artifacts',
  'Publish',
  'Share',
  'Retry',
  'Rename',
  'Delete chat',
  'Projects',
  'Custom instructions',
  'How can Claude help',
  'Write, edit, and create content',
  'Add to project',
  'Branch off'
];

console.log('=== Chat 模式专属核心词条覆盖率审查 ===\n');

for (const kw of chatKeywords) {
  const matches = Object.entries(backup).filter(([k, v]) => v.toLowerCase().includes(kw.toLowerCase()));
  console.log(`关键词 [${kw}] (匹配到官方词条 ${matches.length} 条):`);
  matches.slice(0, 2).forEach(([k, enVal]) => {
    console.log(`   - Key: [${k}]`);
    console.log(`     EN: "${enVal.replace(/\n/g, ' ')}"`);
    console.log(`     ZH: "${(ionZh[k] || '[MISSING]').replace(/\n/g, ' ')}"`);
  });
  console.log('');
}
