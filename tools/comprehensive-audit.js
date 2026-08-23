/**
 * 全维度字典一致性与质量审计脚本 (Comprehensive Localization Audit)
 */
const fs = require('fs');
const path = require('path');
const { extractVariables, extractPlaceholders } = require('./icu-validator');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const ionEnBackup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));
const shellZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/zh-CN.json'), 'utf8'));
const shellEnBase = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/en-US.base.json'), 'utf8'));
const dynZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/dynamic-zh-CN.json'), 'utf8'));

console.log('=== 全维度本地化审计开始 ===\n');

let issuesCount = 0;

// 1. 检查 1uz/I31pXU (1M 误翻)
if (ionZh['1uz/I31pXU'] !== '1M') {
  console.log(`[发现问题] 1uz/I31pXU 当前为 "${ionZh['1uz/I31pXU']}"，应修复为 "1M" (上下文规格)`);
  issuesCount++;
}

// 2. 检查极短词条中的专有名词/缩写误翻
console.log('\n--- 审计 1: 极短技术缩写与上下文单位 ---');
const shortUnitFixes = [];
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = ionEnBackup[k];
  if (!enVal) continue;

  // 比如 1M, 2M, 128k 等模型规格
  if (/^\d+[kKmMgGtTbB]$/.test(enVal.trim())) {
    if (zhVal.includes('月') || zhVal.includes('分') || zhVal.includes('年')) {
      console.log(`  ⚠️ 规格单位误翻: [${k}] EN: "${enVal}" -> ZH: "${zhVal}"`);
      shortUnitFixes.push({ key: k, en: enVal, zh: zhVal });
      issuesCount++;
    }
  }
}

// 3. 检查 HTML 标签闭合性
console.log('\n--- 审计 2: HTML 标签对称性 ---');
const tags = ['b', 'i', 'code', 'link', 'a', 'span', 'strong', 'em'];
let tagMismatchCount = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = ionEnBackup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  for (const tag of tags) {
    const openEn = (enVal.match(new RegExp(`<${tag}[^>]*>`, 'g')) || []).length;
    const closeEn = (enVal.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    const openZh = (zhVal.match(new RegExp(`<${tag}[^>]*>`, 'g')) || []).length;
    const closeZh = (zhVal.match(new RegExp(`</${tag}>`, 'g')) || []).length;

    if (openEn !== openZh || closeEn !== closeZh) {
      console.log(`  ⚠️ HTML 标签不匹配 [${k}] <${tag}>: EN(${openEn}/${closeEn}) vs ZH(${openZh}/${closeZh})`);
      console.log(`     EN: ${enVal}`);
      console.log(`     ZH: ${zhVal}`);
      tagMismatchCount++;
      issuesCount++;
    }
  }
}
console.log(`HTML 标签校验完毕，异常数: ${tagMismatchCount}`);

// 4. 检查专有名词误翻 (MCP, Artifacts, Token, DeepSeek, Claude)
console.log('\n--- 审计 3: 核心专有名词保护 ---');
const protectedTerms = ['MCP', 'Claude', 'API', 'CLI', 'OAuth', 'SSH', 'JSON', 'BLE', 'QEMU', 'KVM'];
let termIssues = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = ionEnBackup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  for (const term of protectedTerms) {
    if (enVal.includes(term) && !zhVal.includes(term)) {
      // 允许在某些特定描述中用同义词，但关键协议名不应丢
      if (term === 'MCP' || term === 'OAuth' || term === 'BLE' || term === 'QEMU' || term === 'KVM') {
        console.log(`  ⚠️ 专有名词丢失 [${k}] ${term}: EN="${enVal}" -> ZH="${zhVal}"`);
        termIssues++;
        issuesCount++;
      }
    }
  }
}
console.log(`专有名词校验完毕，异常数: ${termIssues}`);

// 5. 检查 ICU 占位符变量一致性
console.log('\n--- 审计 4: ICU 变量名一致性抽检 ---');
let icuIssues = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = ionEnBackup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  const enVars = extractVariables(enVal).sort();
  const zhVars = extractVariables(zhVal).sort();

  if (enVars.join(',') !== zhVars.join(',')) {
    console.log(`  ⚠️ ICU 变量名不匹配 [${k}]: EN=[${enVars.join(', ')}] vs ZH=[${zhVars.join(', ')}]`);
    icuIssues++;
    issuesCount++;
  }
}
console.log(`ICU 变量一致性校验完毕，异常数: ${icuIssues}`);

console.log(`\n=== 审计总结: 发现并定位 ${issuesCount} 项潜在优化点 ===`);
