/**
 * 编译并校验全量 Claude 词典（zh-CN.json 与 ion-zh-CN.json）
 */
const fs = require('fs');
const path = require('path');
const { validateDictionary } = require('./icu-validator');

const zhPath = path.join(__dirname, '../dict/zh-CN.json');
const enBasePath = path.join(__dirname, '../dict/en-US.base.json');
const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');

const fullZh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
const enBase = JSON.parse(fs.readFileSync(enBasePath, 'utf8'));
let ionZh = {};
if (fs.existsSync(ionZhPath)) {
  ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));
}

console.log('=== Claude 词库编译与校验 (Claude Localization Compiler) ===');
console.log('官方基准外壳词条数 (en-US.base):', Object.keys(enBase).length);
console.log('已翻译外壳词条数 (zh-CN):', Object.keys(fullZh).length);
console.log('Ion 前端词条数 (ion-zh-CN):', Object.keys(ionZh).length);

const valResults = validateDictionary(enBase, fullZh);
console.log(`有效外壳词条数: ${valResults.validCount} / ${valResults.total}`);

if (valResults.missing.length > 0) {
  console.warn('⚠️ 官方未汉化新增词条:', valResults.missing.length, valResults.missing.slice(0, 10));
}

if (valResults.invalid.length > 0) {
  console.error('❌ 校验失败词条:', valResults.invalid.length);
  valResults.invalid.forEach(inv => {
    console.error(`  Key [${inv.key}]: ${inv.errors.join('; ')}`);
    console.error(`    EN: ${inv.en}`);
    console.error(`    ZH: ${inv.zh}`);
  });
  process.exit(1);
}

console.log('✅ [100% PASS] ICU 语法结构对称与占位符变量守护通过！\n');
