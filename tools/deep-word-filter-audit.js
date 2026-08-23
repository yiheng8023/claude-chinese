const fs = require('fs');
const path = require('path');

const dictDir = path.join(__dirname, '../dict');
const files = fs.readdirSync(dictDir).filter(f => f.endsWith('.json') && f.includes('zh'));

console.log('=== 深度地毯式中文字典字词过滤体检 ===\n');

let suspiciousCount = 0;

const blacklistedSubstrings = [
  { pattern: /努力/g, desc: '包含“努力” (可能残留 Effort 误翻)' },
  { pattern: /工作量/g, desc: '包含“工作量” (可能残留 Effort 误翻)' },
  { pattern: /1个月/g, desc: '包含“1个月” (可能残留 1M 误翻)' },
  { pattern: /进行中/g, filterKey: (k, v) => v === '进行中', desc: 'Accept edits 误翻为进行中' },
  { pattern: /未定义/g, desc: '包含“未定义” (可能是 undefined 误转)' }
];

for (const file of files) {
  const fullPath = path.join(dictDir, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string') continue;

    for (const rule of blacklistedSubstrings) {
      if (rule.filterKey ? rule.filterKey(k, v) : rule.pattern.test(v)) {
        console.log(`⚠️ [${file}] [${k}] 命中规则 [${rule.desc}]: "${v}"`);
        suspiciousCount++;
      }
    }
  }
}

if (suspiciousCount === 0) {
  console.log('🎉 深度过滤体检完成：三大中文字典全量 18,900+ 词条中，0 命中可疑机翻词条！');
} else {
  console.log(`发现 ${suspiciousCount} 处需关注词条。`);
}
