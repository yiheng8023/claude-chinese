/**
 * 自动化测试 2: ICU 占位符与变量结构防火墙质量断言 (全量三套字典覆盖)
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { validateDictionary, validateSyntax } = require('../tools/icu-validator');
const { getClaudeInstallation } = require('../core/msix-detector');
const { readOfficialCatalog } = require('../core/catalogs');

console.log('--- 测试 2: 验证全量三套字典 ICU 占位符结构与专有名词 ---');

// 1. 验证 Shell 字典 (en-US.base.json vs zh-CN.json)
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/en-US.base.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/zh-CN.json'), 'utf8'));

const valResults = validateDictionary(base, zh);
console.log(`[Shell 字典] 有效词条数: ${valResults.validCount} / ${valResults.total}`);

if (valResults.invalid.length > 0) {
  console.error('发现 ICU 结构异常:');
  valResults.invalid.forEach(inv => {
    console.error(`[${inv.key}]: ${inv.errors.join('; ')}`);
  });
}

assert.strictEqual(valResults.missing.length, 0, 'Shell 字典不应有缺失词条');
assert.strictEqual(valResults.invalid.length, 0, 'Shell 字典不应有 ICU 结构异常');

// 核心专有名词保护断言 (MCP, Claude, Cowork, Code 等)
const mcpKeys = Object.keys(base).filter(k => base[k].includes('MCP'));
for (const k of mcpKeys) {
  assert(zh[k].includes('MCP'), `MCP 专有名词在 key [${k}] 中被误翻译或丢失: ${zh[k]}`);
}

// 2. 验证 Ion-Dist 全量大词库 (ion-zh-CN.json, 18,500+ 词条)
const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
let ionTotal = 0;
let ionInvalidCount = 0;
if (fs.existsSync(ionZhPath)) {
  const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));
  ionTotal = Object.keys(ionZh).length;
  for (const [key, text] of Object.entries(ionZh)) {
    if (typeof text === 'string') {
      if (!validateSyntax(text).valid) {
        console.error(`[Ion-Dist 大括号不闭合] key: ${key}, text: ${text}`);
        ionInvalidCount++;
      }
    }
  }
  console.log(`[Ion-Dist 核心词库] 已通过语法结构校验: ${ionTotal - ionInvalidCount} / ${ionTotal}`);
  assert.strictEqual(ionInvalidCount, 0, 'Ion-Dist 词库不应有大括号不闭合或结构破坏的词条');
}

// 3. 验证 Dynamic 动态模型词库 (dynamic-zh-CN.json)
const dynZhPath = path.join(__dirname, '../dict/dynamic-zh-CN.json');
let dynTotal = 0;
let dynInvalidCount = 0;
if (fs.existsSync(dynZhPath)) {
  const dynZh = JSON.parse(fs.readFileSync(dynZhPath, 'utf8'));
  dynTotal = Object.keys(dynZh).length;
  for (const [key, text] of Object.entries(dynZh)) {
    if (typeof text === 'string') {
      if (!validateSyntax(text).valid) {
        console.error(`[Dynamic 词库大括号不闭合] key: ${key}, text: ${text}`);
        dynInvalidCount++;
      }
    }
  }
  console.log(`[Dynamic 动态词库] 已通过语法结构校验: ${dynTotal - dynInvalidCount} / ${dynTotal}`);
  assert.strictEqual(dynInvalidCount, 0, 'Dynamic 词库不应有大括号不闭合或结构破坏的词条');
}

const info = getClaudeInstallation();
for (const [layer, dict] of [['ion', 'ion-zh-CN.json'], ['dynamic', 'dynamic-zh-CN.json']]) {
  const official = readOfficialCatalog(info, layer);
  if (!official) { console.log(`[${layer}] 未安装可读取的宿主，英文对照检查跳过。`); continue; }
  const result = validateDictionary(official.dictionary, JSON.parse(fs.readFileSync(path.join(__dirname, '../dict', dict), 'utf8')));
  assert.deepEqual(result.invalid.map(item => ({ key: item.key, errors: item.errors })), [], `${layer} 当前宿主变量结构不匹配`);
  console.log(`[${layer}] 已对照当前宿主校验 ${result.validCount} 项，未收录 ${result.missing.length} 项保留英文回退。`);
}
console.log(`✅ ICU 校验通过：外壳英文对照与 ${ionTotal + dynTotal} 项消息语法检查完成。`);
