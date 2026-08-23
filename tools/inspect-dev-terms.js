const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('--- 深度审查开发者与会话高频词条 ---');

const termsToInspect = [
  'Bypass Permissions',
  'Thinking budget',
  'Prompt caching',
  'Subagents',
  'Custom connectors',
  'Local agent',
  'Code review',
  'Diff',
  'Patch',
  'Workspace'
];

for (const term of termsToInspect) {
  const matches = Object.entries(backup).filter(([k, v]) => v.toLowerCase().includes(term.toLowerCase()));
  console.log(`\n🔍 术语 [${term}] (匹配到 ${matches.length} 条):`);
  matches.slice(0, 2).forEach(([k, enVal]) => {
    console.log(`  [${k}]`);
    console.log(`  EN: "${enVal.replace(/\n/g, ' ')}"`);
    console.log(`  ZH: "${(ionZh[k] || '[MISSING]').replace(/\n/g, ' ')}"`);
  });
}
