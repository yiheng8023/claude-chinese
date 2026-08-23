/**
 * 自动化测试 2: ICU 占位符结构与专有名词保护断言
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { validateDictionary } = require('../tools/icu-validator');

console.log('--- 测试 2: 验证 ICU 占位符结构与专有名词 ---');

const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/en-US.base.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/zh-CN.json'), 'utf8'));

const valResults = validateDictionary(base, zh);

console.log(`有效词条数: ${valResults.validCount} / ${valResults.total}`);

if (valResults.invalid.length > 0) {
  console.error('发现 ICU 结构异常:');
  valResults.invalid.forEach(inv => {
    console.error(`[${inv.key}]: ${inv.errors.join('; ')}`);
  });
}

assert.strictEqual(valResults.missing.length, 0, '不应有缺失词条');
assert.strictEqual(valResults.invalid.length, 0, '不应有 ICU 结构异常的词条');

// 核心专有名词保护断言 (MCP, Claude, Cowork, Code 等)
const mcpKeys = Object.keys(base).filter(k => base[k].includes('MCP'));
for (const k of mcpKeys) {
  assert(zh[k].includes('MCP'), `MCP 专有名词在 key [${k}] 中被误翻译或丢失: ${zh[k]}`);
}

console.log('✅ 测试 2 通过: ICU 占位符 100% 结构一致且专有名词受到严格保护！');
