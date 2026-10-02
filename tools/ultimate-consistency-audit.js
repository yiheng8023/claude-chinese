/**
 * 终极全局一致性与深度质量体检分析器 (Ultimate Consistency Audit)
 */
const fs = require('fs');
const path = require('path');
const { extractVariables } = require('./icu-validator');
const { getClaudeInstallation } = require('../core/msix-detector');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const shellZhPath = path.join(__dirname, '../dict/zh-CN.json');
const shellBasePath = path.join(__dirname, '../dict/en-US.base.json');
const dynZhPath = path.join(__dirname, '../dict/dynamic-zh-CN.json');

const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));
const shellZh = JSON.parse(fs.readFileSync(shellZhPath, 'utf8'));
const shellBase = JSON.parse(fs.readFileSync(shellBasePath, 'utf8'));
const dynZh = JSON.parse(fs.readFileSync(dynZhPath, 'utf8'));

// 动态寻找官方 en-US 词典路径
const info = getClaudeInstallation();
let ionEn = {};
let foundEnPath = null;

if (info.resourcesPath) {
  const cand1 = path.join(info.resourcesPath, 'ion-dist', 'i18n', 'en-US.json');
  const cand2 = path.join(info.resourcesPath, 'ion-dist', 'i18n', 'en-US.backup.json');
  if (fs.existsSync(cand1)) foundEnPath = cand1;
  else if (fs.existsSync(cand2)) foundEnPath = cand2;
}

if (foundEnPath && fs.existsSync(foundEnPath)) {
  try { ionEn = JSON.parse(fs.readFileSync(foundEnPath, 'utf8')); } catch (e) {}
}

console.log('====================================================');
console.log('   Claude-Chinese 终极全局一致性深度体检');
console.log('====================================================\n');

let issues = [];

// 1. 检查 Effort 术语是否还有遗留的“工作量”或“努力程度”
console.log('【一致性检查 1】Effort / 推理强度 术语一致性');
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = ionEn[k];
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
  const enVal = ionEn[k];
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
    const enVal = ionEn[k];
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
  const enVal = ionEn[k];
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
  const enVal = ionEn[k];
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

// 6. 检查 Fork 与 Branch 概念隔离与全域一致性
console.log('\n【一致性检查 6】Fork (分叉) 与 Branch (分支) 概念隔离一致性');
let forkErrors = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = ionEn[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  // 1. 英文为 Fork 动作/派生，中文绝对严禁出现“分支”
  if (/\bfork/i.test(enVal)) {
    if (zhVal.includes('分支')) {
      console.log(`  ⚠️ [Fork 误用分支] [${k}] EN: "${enVal}" -> ZH: "${zhVal}" (必须统一为“分叉”)`);
      forkErrors++;
      issues.push({ key: k, type: 'fork_branch_confusion', en: enVal, zh: zhVal });
    }
  }

  // 2. 检查会话核心单字/短语动作词
  if (enVal === 'Fork' && zhVal !== '分叉') {
    console.log(`  ⚠️ [动作词不规范] [${k}] Fork 实际为 "${zhVal}" (期望: "分叉")`);
    forkErrors++;
    issues.push({ key: k, type: 'fork_verb_mismatch', en: enVal, zh: zhVal });
  }
  if (enVal === 'Forking…' && zhVal !== '正在分叉…') {
    console.log(`  ⚠️ [动作词不规范] [${k}] Forking… 实际为 "${zhVal}" (期望: "正在分叉…")`);
    forkErrors++;
    issues.push({ key: k, type: 'fork_verb_mismatch', en: enVal, zh: zhVal });
  }
  if (enVal === 'Fork from here' && zhVal !== '从此处分叉') {
    console.log(`  ⚠️ [动作词不规范] [${k}] Fork from here 实际为 "${zhVal}" (期望: "从此处分叉")`);
    forkErrors++;
    issues.push({ key: k, type: 'fork_verb_mismatch', en: enVal, zh: zhVal });
  }
}

// 7. 检查 Diff (差异) 与 Change (变更) 概念隔离与术语一致性
console.log('\n【一致性检查 7】Diff (差异) 与 Change (变更) 概念隔离一致性');
let diffErrors = 0;
for (const [k, zhVal] of Object.entries(ionZh)) {
  const enVal = ionEn[k];
  if (!enVal || typeof zhVal !== 'string') continue;

  // 英文单独出现 diff 或 diff view，中文严禁混淆为“变更”
  if (/\bdiffs?\b/i.test(enVal)) {
    if (zhVal.includes('变更') || (zhVal.includes('更改') && !/\bchanges?\b/i.test(enVal))) {
      console.log(`  ⚠️ [Diff 误用变更] [${k}] EN: "${enVal}" -> ZH: "${zhVal}" (Diff 必须统一为“差异”)`);
      diffErrors++;
      issues.push({ key: k, type: 'diff_change_confusion', en: enVal, zh: zhVal });
    }
  }

  if ((enVal === 'Diff' || enVal === 'diff') && !zhVal.includes('差异')) {
    console.log(`  ⚠️ [Diff 名词不规范] [${k}] Diff 实际为 "${zhVal}" (期望包含: "差异")`);
    diffErrors++;
    issues.push({ key: k, type: 'diff_noun_mismatch', en: enVal, zh: zhVal });
  }
}

// 8. 检查原生状态机动作词与状态枚举完整性 (State Machine Enum Integrity)
console.log('\n【一致性检查 8】原生状态机动作词与状态枚举完整性');
let stateMachineErrors = 0;
const STATE_MACHINE_KEYS = [
  '5DvVdHWYeP', 'WSaR3s9y+0', 'HQcXlU4DEE', 'UXI5kx9c08', 'WCIAidgueo',
  'gKeZD/jxpC', 'MTgdhQxTPQ', 'JIsnwRlH0D', 'sjdp6mtP7Y', '9GA6hZ6RkN',
  'RIbw6nN4dR', '+B6q99cXCl', '7ZK71R9n1B', '5iGwHk/pKZ', '5KajyzHSXj',
  'nxxRes7Qf3', 'V/QOi0yNF0', 'Lsex8QeaTL', 'YBctaBAMh/', '6LJ9la6t+4',
  'WcmN0GCOgd', 'RxYks1LFQg', 'YQEir3q/V5', 'IwRaId+4hv', 'kbCx2ZYlvk',
  'ZgCKHNUoS+', 'gAR0atqpRn', 'sciEMhbXbm', 'Jdgq0BVjao',
  'MVQTRBWYud', 'cPnivFkT6E', 'tTVI3GQeyu', '14+jcDS33B', 'wT63jkA9qK',
  'y5DX5NCmrm', 'MM7OHMBA9j', '242T21lCRb', '8XsqEcZQPV', 'ZdOS6uyq8n',
  '4+310Bnuvz', 'HNOICFXsf+', '8HFdOJrw5u', 'XDtMLEgWf6', 'ncpruch8SM',
  'zuMUqU9v6W', 'u/hJEKf1tL', '9j5ma+F5F5', 'cv9VNYMHXY', 'LVG1dX6B8u',
  'WSkLyhVgSu', 'X9Z2S33opa', 'tEIdSD1dER', 'ze8mOEi4wo', '0AQGELjf8F',
  'QE4MKdaawu'
];

for (const k of STATE_MACHINE_KEYS) {
  const zh = ionZh[k];
  if (!zh || typeof zh !== 'string' || !zh.trim()) {
    console.log(`  ⚠️ [状态机枚举缺失] 键 [${k}] 在 ion-zh-CN.json 中未定义或为空！`);
    stateMachineErrors++;
    issues.push({ key: k, type: 'state_machine_missing', en: ionEn[k] || '' });
  }
}

console.log('\n====================================================');
console.log(`体检总结: 发现并定位 ${issues.length} 项潜在优化点 (ICU: ${icuErrors}, 标签: ${tagErrors}, Fork/Branch: ${forkErrors}, Diff/Change: ${diffErrors}, 状态机枚举: ${stateMachineErrors})`);
console.log('====================================================');


