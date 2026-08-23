/**
 * 全局语义与高危术语深度校对分析器 (Global Semantic Proofreading)
 */
const fs = require('fs');
const path = require('path');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));

console.log('=== 全局语义与高危术语深度校对开始 ===\n');

const potentialMistranslations = [];

// 1. 检查 Git / 开发者术语歧义
const devTerms = [
  { term: 'checkout', bad: ['结账', '结帐', '签出'], good: '检出' },
  { term: 'commit', bad: ['承诺', '委托', '犯罪'], good: '提交' },
  { term: 'branch', bad: ['树枝', '分店', '支线'], good: '分支' },
  { term: 'fork', bad: ['叉子', '餐叉'], good: '复刻 / 派生' },
  { term: 'terminal', bad: ['晚期', '末端', '航站楼'], good: '终端' },
  { term: 'token', bad: ['象征', '代币', '筹码'], good: '令牌 / Token' },
  { term: 'artifact', bad: ['人工制品', '手工艺品', '史前古器物'], good: '制品 / 产物' },
  { term: 'prompt', bad: ['准时', '迅速', '督促'], good: '提示词 / 提示' },
  { term: 'patch', bad: ['眼罩', '膏药', '补丁包'], good: '补丁' },
  { term: 'host', bad: ['东道主', '主人', '寄主'], good: '宿主 / 主机' },
  { term: 'running', bad: ['跑步', '赛跑'], good: '运行中' },
  { term: 'session', bad: ['开庭', '会议', '学期'], good: '会话' },
  { term: 'model', bad: ['模特', '模型制作'], good: '模型' }
];

for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = backup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  for (const item of devTerms) {
    const enLower = enVal.toLowerCase();
    if (new RegExp(`\\b${item.term}\\b`, 'i').test(enLower)) {
      for (const badWord of item.bad) {
        if (zhVal.includes(badWord)) {
          console.log(`⚠️ [术语歧义] Key: [${k}] 包含 "${badWord}" (应为 "${item.good}")`);
          console.log(`   EN: ${enVal}`);
          console.log(`   ZH: ${zhVal}\n`);
          potentialMistranslations.push({ key: k, type: 'ambiguity', term: item.term, badWord, en: enVal, zh: zhVal });
        }
      }
    }
  }
}

// 2. 检查极短字符串（<= 6 字符）中的英文残留与异常机翻
console.log('--- 极短字符串 (<= 6 字符) 审查 ---');
let shortWordIssues = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = backup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  if (enVal.length <= 6 && /^[a-zA-Z\s]+$/.test(enVal.trim())) {
    // 纯英文短词但中文未翻译成汉字的（排除常见缩写如 OK, ID, IP, CPU, GPU, UI, API, URL, MCP）
    const allowedAbbreviations = ['OK', 'ID', 'IP', 'CPU', 'GPU', 'UI', 'API', 'URL', 'MCP', 'SSH', 'JSON', 'Git', 'PDF', 'CSV', 'VS', 'Code', 'Chat', 'Cowork', 'Claude'];
    const trimmedZh = zhVal.trim();
    if (/^[a-zA-Z\s]+$/.test(trimmedZh) && !allowedAbbreviations.includes(trimmedZh.toUpperCase()) && !allowedAbbreviations.includes(trimmedZh)) {
      console.log(`⚠️ [短词未汉化] Key: [${k}] EN: "${enVal}" -> ZH: "${zhVal}"`);
      shortWordIssues++;
      potentialMistranslations.push({ key: k, type: 'short_untranslated', en: enVal, zh: zhVal });
    }
  }
}

// 3. 检查长度严重不对称的异常串词（例如 EN 只有十几个字符，ZH 上百字，或者反过来）
console.log('\n--- 串词与异常长度不匹配审查 ---');
let mismatchCount = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = backup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  if (enVal.length < 20 && zhVal.length > 80) {
    console.log(`⚠️ [潜在串词] Key: [${k}] EN (${enVal.length}字): "${enVal}" vs ZH (${zhVal.length}字): "${zhVal}"`);
    mismatchCount++;
    potentialMistranslations.push({ key: k, type: 'mismatch_len', en: enVal, zh: zhVal });
  }
}

console.log(`\n=== 深度校对总结: 发现 ${potentialMistranslations.length} 项可精校词条 ===`);
