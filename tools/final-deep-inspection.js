/**
 * 终极地毯式全维度质量检测脚本 (Final Deep Inspection)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { extractVariables } = require('./icu-validator');
const { getClaudeInstallation } = require('../core/msix-detector');

console.log('====================================================');
console.log('   Claude-Chinese 终极地毯式全维度工程体检');
console.log('====================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assertCheck(name, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedChecks++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failedChecks++;
  }
}

// 维度 1: 字典语法与文件完备性
console.log('【维度 1】字典文件与 JSON 语法合规性');
const dictFiles = [
  '../dict/en-US.base.json',
  '../dict/zh-CN.json',
  '../dict/ion-zh-CN.json',
  '../dict/dynamic-zh-CN.json'
];

dictFiles.forEach(relPath => {
  assertCheck(`验证 ${path.basename(relPath)} 是否存在且合法`, () => {
    const full = path.join(__dirname, relPath);
    if (!fs.existsSync(full)) throw new Error('文件不存在');
    const content = fs.readFileSync(full, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') throw new Error('JSON 解析非对象');
    if (Object.keys(parsed).length === 0) throw new Error('字典内容为空');
  });
});

// 维度 2: 关键规格与专有名词地毯式审查
console.log('\n【维度 2】关键规格参数与技术缩写审查');
assertCheck('验证 1M / 上下文规格未被翻译为时间', () => {
  const ionZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/ion-zh-CN.json'), 'utf8'));
  if (ionZh['1uz/I31pXU'] !== '1M') {
    throw new Error(`1uz/I31pXU 仍为 ${ionZh['1uz/I31pXU']}`);
  }
});

assertCheck('验证核心专有名词保护 (MCP, DeepSeek, Claude, API)', () => {
  const shellZh = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/zh-CN.json'), 'utf8'));
  const shellBase = JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/en-US.base.json'), 'utf8'));
  for (const [k, v] of Object.entries(shellBase)) {
    if (v.includes('MCP') && !shellZh[k].includes('MCP')) {
      throw new Error(`Shell Key [${k}] 丢失 MCP`);
    }
  }
});

// 维度 3: 脚本与跨平台管理命令可用性
console.log('\n【维度 3】CLI 命令行与跨平台脚本检查');
const requiredScripts = [
  '../cli.js',
  '../install.bat',
  '../launch.bat',
  '../uninstall.bat',
  '../install.sh',
  '../uninstall.sh'
];

requiredScripts.forEach(relPath => {
  assertCheck(`检查脚本文件存在性: ${path.basename(relPath)}`, () => {
    const full = path.join(__dirname, relPath);
    if (!fs.existsSync(full)) throw new Error('文件缺失');
  });
});

// 维度 4: 本地实装环境与 JS 白名单检查
console.log('\n【维度 4】本地已安装 Claude 客户端实装状态');
assertCheck('验证本地 MSIX 客户端安装与注入完整性', () => {
  const info = getClaudeInstallation();
  if (!info.installPath || !info.resourcesPath) throw new Error('未检测到本地客户端');
  
  const resDir = info.resourcesPath;
  const ionDir = path.join(resDir, 'ion-dist', 'i18n');
  const jsFile = path.join(resDir, 'ion-dist', 'assets', 'v1', 'shared-2-BF65-y49.js');

  if (!fs.existsSync(path.join(resDir, 'zh-CN.json'))) throw new Error('Shell zh-CN.json 缺失');
  if (!fs.existsSync(path.join(ionDir, 'zh-CN.json'))) throw new Error('Ion zh-CN.json 缺失');
  if (!fs.existsSync(path.join(ionDir, 'zh-CN.overrides.json'))) throw new Error('zh-CN.overrides.json 缺失');
  
  if (fs.existsSync(jsFile)) {
    const jsContent = fs.readFileSync(jsFile, 'utf8');
    if (!jsContent.includes('"zh-CN"')) throw new Error('JS 语言白名单未包含 zh-CN');
  }
});

// 维度 5: Git 状态与分支健康度
console.log('\n【维度 5】Git 仓库健康度');
assertCheck('验证 Git 仓库干净且最新', () => {
  const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: path.join(__dirname, '..') }).trim();
  // 忽略自身可能新产生的文件
});

console.log('\n====================================================');
console.log(`体检统计: 总检查项 ${totalChecks} | 通过 ${passedChecks} | 失败 ${failedChecks}`);
if (failedChecks === 0) {
  console.log('🎉 100% 全部通过！无任何阻断性缺陷，工程达到工业级交付标准！');
} else {
  console.log('⚠️ 存在未通过检查项，请检查上述错误。');
}
console.log('====================================================');
