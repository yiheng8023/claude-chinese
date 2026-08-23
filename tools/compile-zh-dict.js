/**
 * 编译并验证全量 zh-CN.json 词典
 */
const fs = require('fs');
const path = require('path');
const { validateDictionary } = require('./icu-validator');

const p1 = require('./dict-data.js');
const p2 = require('./dict-data-part2.js');
const p3 = require('./dict-data-part3.js');
const p4 = require('./dict-data-part4.js');
const p5 = require('./dict-data-part5.js');

const fullZh = Object.assign({}, p1, p2, p3, p4, p5);

const enBase = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/en-US.base.json'), 'utf8'));

console.log('=== Claude 词库编译与校验 ===');
console.log('官方基准词条总数:', Object.keys(enBase).length);
console.log('已翻译中文词条总数:', Object.keys(fullZh).length);

const valResults = validateDictionary(enBase, fullZh);
console.log(`有效词条数: ${valResults.validCount} / ${valResults.total}`);

if (valResults.missing.length > 0) {
  console.error('❌ 缺失词条:', valResults.missing.length, valResults.missing);
}

if (valResults.invalid.length > 0) {
  console.error('❌ 校验失败词条:', valResults.invalid.length);
  valResults.invalid.forEach(inv => {
    console.error(`  Key [${inv.key}]: ${inv.errors.join('; ')}`);
    console.error(`    EN: ${inv.en}`);
    console.error(`    ZH: ${inv.zh}`);
  });
}

if (valResults.missing.length === 0 && valResults.invalid.length === 0) {
  const outPath = path.join(__dirname, '../dict/zh-CN.json');
  fs.writeFileSync(outPath, JSON.stringify(fullZh, null, 2), 'utf8');
  console.log('✅ 100% 校验通过！全量字典已成功写入:', outPath);
} else {
  console.warn('⚠️ 存在未通过校验的词条，暂未写入最终字典。');
}
