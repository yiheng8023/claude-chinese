/**
 * 终极全局一致性与深度质量体检分析器 (Ultimate Consistency Audit)
 */
const fs = require('fs');
const path = require('path');
const { extractVariables } = require('./icu-validator');

const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('C:/Program Files/WindowsApps/Claude_1.34493.1.0_x64__pzs8sxrjxfjjc/app/resources/ion-dist/i18n/en-US.backup.json', 'utf8'));
const shellZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/zh-CN.json'), 'utf8'));
const shellBase = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/en-US.base.json'), 'utf8'));
const dynZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/dynamic-zh-CN.json'), 'utf8'));

console.log('====================================================');
console.log('   Claude-Chinese 终极全局一致性深度体检');
console.log('====================================================\n');

let issues = [];

// 1. 检查 Effort 术语是否还有遗留的“工作量”或“努力程度”
console.log('【一致性检查 1】Effort / 推理强度 术语一致性');
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = backup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  if (/\beffort\b/i.test(enVal)) {
    if (zhVal.includes('工作量') || zhVal.includes('努力程度') || zhVal.includes('努力级别')) {
      console.log(`  ⚠️ [术语不一致] [${k}] EN: "${enVal}" -> ZH: "${zhVal}"`);
      issues.push({ key: k, type: 'effort_inconsistency', en: enVal, zh: zhVal });
    }
  }
}

// 2. 检查模式术语 (Manual / Plan / Accept edits / Bypass permissions)
console.log('\n【一致性检查 2】工作流与审批模式 术语一致性');
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = backup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  if (enVal === 'Accept edits' && zhVal !== '接受编辑') {
    console.log(`  ⚠️ [模式不一致] Accept edits -> "${zhVal}"`);
    issues.push({ key: k, type: 'mode_inconsistency', en: enVal, zh: zhVal });
  }
  if (enVal === 'Manual' && zhVal !== '手动') {
    console.log(`  ⚠️ [模式不一致] Manual -> "${zhVal}"`);
    issues.push({ key: k, type: 'mode_inconsistency', en: enVal, zh: zhVal });
  }
  if (enVal === 'Plan' && zhVal !== '计划') {
    console.log(`  ⚠️ [模式不一致] Plan -> "${zhVal}"`);
    issues.push({ key: k, type: 'mode_inconsistency', en: enVal, zh: zhVal });
  }
}

// 3. 检查通用操作动作词 (Save, Cancel, Delete, Confirm, Copy, Share, Retry)
console.log('\n【一致性检查 3】通用高频操作动作词一致性');
const actionMap = {
  'Save': '保存',
  'Cancel': '取消',
  'Delete': '删除',
  'Confirm': '确认',
  'Retry': '重试',
  'Copy': '复制',
  'Close': '关闭'
};

for (const [enAction, expectedZh] of Object.entries(actionMap)) {
  for (const [k, zhVal] of Object.entries(ionZh)) {
    const enVal = backup[k];
    if (enVal === enAction && zhVal !== expectedZh) {
      console.log(`  ⚠️ [动作词不一致] [${k}] EN: "${enVal}" -> ZH: "${zhVal}" (期望: "${expectedZh}")`);
      issues.push({ key: k, type: 'action_inconsistency', en: enVal, zh: zhVal });
    }
  }
}

// 4. 检查 ICU 占位符与变量安全性
console.log('\n【一致性检查 4】ICU 占位符与变量结构一致性');
let icuErrors = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = backup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  const enVars = extractVariables(enVal).sort();
  const zhVars = extractVariables(zhVal).sort();

  if (enVars.join(',') !== zhVars.join(',')) {
    console.log(`  ⚠️ [ICU 变量不匹配] [${k}]: EN=[${enVars.join(',')}] vs ZH=[${zhVars.join(',')}]`);
    icuErrors++;
    issues.push({ key: k, type: 'icu_mismatch', en: enVal, zh: zhVal });
  }
}

// 5. 检查 HTML 标签对称性
console.log('\n【一致性检查 5】HTML 标签对称性');
const tags = ['b', 'i', 'code', 'link', 'a', 'span', 'strong', 'em', 'bold'];
let tagErrors = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = backup[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  for (const tag of tags) {
    const openEn = (enVal.match(new RegExp(`<${tag}[^>]*>`, 'g')) || []).length;
    const closeEn = (enVal.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    const openZh = (zhVal.match(new RegExp(`<${tag}[^>]*>`, 'g')) || []).length;
    const closeZh = (zhVal.match(new RegExp(`</${tag}>`, 'g')) || []).length;

    if (openEn !== openZh || closeEn !== closeZh) {
      console.log(`  ⚠️ [HTML 标签不匹配] [${k}] <${tag}>: EN(${openEn}/${closeEn}) vs ZH(${openZh}/${closeZh})`);
      tagErrors++;
      issues.push({ key: k, type: 'tag_mismatch', en: enVal, zh: zhVal });
    }
  }
}

console.log('\n====================================================');
console.log(`体检总结: 发现并定位 ${issues.length} 项潜在优化点 (ICU 错误: ${icuErrors}, HTML 标签错误: ${tagErrors})`);
console.log('====================================================');
