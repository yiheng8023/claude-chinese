/**
 * 上游版本文本漂移分析引擎 (Drift Detector)
 * 移植自 Antigravity-Chinese 汉化体系，提供官方新旧版本词条 Diff 与覆盖率报告。
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('../core/msix-detector');

function runDriftDetection(customEnPath = null) {
  let targetEnPath = customEnPath;

  if (!targetEnPath) {
    const info = getClaudeInstallation();
    if (info && info.resourcesPath) {
      targetEnPath = path.join(info.resourcesPath, 'en-US.json');
    }
  }

  if (!targetEnPath || !fs.existsSync(targetEnPath)) {
    targetEnPath = path.join(__dirname, '../dict/en-US.base.json');
  }

  const upstreamDict = JSON.parse(fs.readFileSync(targetEnPath, 'utf8'));
  const zhPath = path.join(__dirname, '../dict/zh-CN.json');
  const zhDict = fs.existsSync(zhPath) ? JSON.parse(fs.readFileSync(zhPath, 'utf8')) : {};

  const upstreamKeys = Object.keys(upstreamDict);
  const zhKeys = Object.keys(zhDict);

  const newKeys = upstreamKeys.filter(k => !zhDict[k]);
  const staleKeys = zhKeys.filter(k => !upstreamDict[k]);
  const matchedKeys = upstreamKeys.filter(k => zhDict[k]);

  const coverage = upstreamKeys.length > 0
    ? ((matchedKeys.length / upstreamKeys.length) * 100).toFixed(2)
    : '0.00';

  const report = {
    timestamp: new Date().toISOString(),
    sourceFile: targetEnPath,
    totalUpstreamKeys: upstreamKeys.length,
    totalZhKeys: zhKeys.length,
    matchedKeysCount: matchedKeys.length,
    coverage: `${coverage}%`,
    newKeysCount: newKeys.length,
    newKeysList: newKeys.map(k => ({ key: k, en: upstreamDict[k] })),
    staleKeysCount: staleKeys.length,
    staleKeysList: staleKeys
  };

  return report;
}

if (require.main === module) {
  console.log('=== Claude 客户端版本漂移检测 (Drift Detection) ===\n');
  const report = runDriftDetection(process.argv[2]);

  console.log(`📡 目标源文件: ${report.sourceFile}`);
  console.log(`📊 官方词条总量: ${report.totalUpstreamKeys}`);
  console.log(`🇨🇳 当前汉化覆盖率: ${report.coverage} (${report.matchedKeysCount} / ${report.totalUpstreamKeys})`);
  console.log(`✨ 新增未汉化词条: ${report.newKeysCount}`);
  console.log(`🗑️ 历史陈旧废弃词条: ${report.staleKeysCount}\n`);

  if (report.newKeysCount > 0) {
    console.log('新增词条样例 (前 5 条):');
    report.newKeysList.slice(0, 5).forEach(item => {
      console.log(`  - [${item.key}]: "${item.en}"`);
    });
  }

  const outReportPath = path.join(__dirname, 'drift-report.json');
  fs.writeFileSync(outReportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`📄 完整漂移分析报告已输出至: ${outReportPath}`);
}

module.exports = {
  runDriftDetection
};
