/**
 * 自动化测试 1: 字典结构与完整性断言
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- 测试 1: 验证字典语法与完整性 ---');

const baseFile = path.join(__dirname, '../dict/en-US.base.json');
const zhFile = path.join(__dirname, '../dict/zh-CN.json');

assert(fs.existsSync(baseFile), 'en-US.base.json 文件必须存在');
assert(fs.existsSync(zhFile), 'zh-CN.json 文件必须存在');

const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
const zh = JSON.parse(fs.readFileSync(zhFile, 'utf8'));

const baseKeys = Object.keys(base);
const zhKeys = Object.keys(zh);

console.log(`基线词条数: ${baseKeys.length}, 中文词条数: ${zhKeys.length}`);

assert.strictEqual(zhKeys.length >= baseKeys.length, true, '中文词条数量应不小于基线词条数量');

// 确保每个基线 key 在中文字典中都有有效翻译且非空
let emptyCount = 0;
for (const k of baseKeys) {
  assert(zh[k] !== undefined, `缺失翻译 key: ${k}`);
  assert(typeof zh[k] === 'string', `翻译值必须是字符串: ${k}`);
  if (zh[k].trim() === '') emptyCount++;
}

assert.strictEqual(emptyCount, 0, '翻译值不能存在空字符串');

console.log('✅ 测试 1 通过: 字典结构完整无缺失！');
