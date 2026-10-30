/**
 * 上游版本文本漂移分析引擎 (Drift Detector)
 * 包含 JSON 字典覆盖率审计与 JS 硬编码常量漂移守卫 (JS Literal Drift Guard)
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('../core/msix-detector');
const { JS_LITERAL_PATCHES, safeTest } = require('../core/patcher');

const asar = require('@electron/asar');

function runDriftDetection(customEnPath = null, options = {}) {
  const { readOfficialCatalog } = require('../core/catalogs');
  const directoryInput = customEnPath && fs.existsSync(customEnPath) && fs.statSync(customEnPath).isDirectory();
  const info = getClaudeInstallation(options.customPath || (directoryInput ? customEnPath : null));
  if (options.customPath && !info.resourcesPath) throw new Error(info.error || '指定的客户端目录缺少资源。');
  const resourcesDir = customEnPath && !directoryInput && !options.customPath ? null : info.resourcesPath;
  let source = null;
  if (customEnPath) {
    if (!fs.existsSync(customEnPath)) throw new Error('指定的英文词典不存在。');
    if (fs.statSync(customEnPath).isDirectory()) {
      source = readOfficialCatalog(getClaudeInstallation(customEnPath));
      if (!source) throw new Error('指定目录没有可读取的英文词典。');
    } else source = { dictionary: JSON.parse(fs.readFileSync(customEnPath, 'utf8')), source: customEnPath, scope: 'explicit-catalog' };
  } else source = readOfficialCatalog(info);
  const sourceScope = source?.scope || 'bundled-shell-baseline';
  const upstreamDict = source?.dictionary || JSON.parse(fs.readFileSync(path.join(__dirname, '../dict/en-US.base.json'), 'utf8'));
  const targetEnPath = source?.source || path.join(__dirname, '../dict/en-US.base.json');
  const zhPath = path.join(__dirname, source ? '../dict/ion-zh-CN.json' : '../dict/zh-CN.json');
  const zhDict = JSON.parse(fs.readFileSync(zhPath, 'utf8'));

  const upstreamKeys = Object.keys(upstreamDict);
  const zhKeys = Object.keys(zhDict);

  const newKeys = upstreamKeys.filter(k => !zhDict[k]);
  const staleKeys = zhKeys.filter(k => !upstreamDict[k]);
  const matchedKeys = upstreamKeys.filter(k => zhDict[k]);

  const coverage = upstreamKeys.length > 0
    ? ((matchedKeys.length / upstreamKeys.length) * 100).toFixed(2)
    : '0.00';

  // 2. JS 硬编码特征漂移检测 (JS Literal Drift Guard)
  const jsPatchesStatus = [];
  if (resourcesDir) {
    const asarPath = path.join(resourcesDir, 'ion-dist.asar');
    const assetsDir = path.join(resourcesDir, 'ion-dist', 'assets', 'v1');
    let allJsContent = '';

    if (fs.existsSync(asarPath)) {
      try {
        const list = asar.listPackage(asarPath);
        const jsEntries = list.filter(e => (e.startsWith('\\assets\\v1\\') || e.startsWith('/assets/v1/')) && e.endsWith('.js'));
        for (const entry of jsEntries) {
          try {
            allJsContent += asar.extractFile(asarPath, entry.replace(/^[\\\/]/, '')).toString('utf8') + '\n';
          } catch (_) {}
        }
      } catch (_) {}
    } else if (fs.existsSync(assetsDir)) {
      const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
      for (const f of jsFiles) {
        try {
          allJsContent += fs.readFileSync(path.join(assetsDir, f), 'utf8') + '\n';
        } catch (e) {}
      }
    }

    if (allJsContent) {
      for (const patch of (JS_LITERAL_PATCHES || [])) {
        const matchesEn = patch.enPattern ? safeTest(patch.enPattern, allJsContent) : false;
        const matchesZh = patch.zhPattern ? safeTest(patch.zhPattern, allJsContent) : false;
        
        let status = 'DRIFTED';
        if (matchesZh) {
          status = 'ACTIVE_PATCHED';
        } else if (matchesEn) {
          status = 'MATCHED_UNPATCHED';
        } else if (patch.intlKey && upstreamDict[patch.intlKey]) {
          status = 'UPSTREAM_STANDARDIZED';
        }

        jsPatchesStatus.push({
          id: patch.id,
          description: patch.description,
          status,
          healthy: status !== 'DRIFTED'
        });
      }
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    sourceFile: targetEnPath,
    sourceScope,
    totalUpstreamKeys: upstreamKeys.length,
    totalZhKeys: zhKeys.length,
    matchedKeysCount: matchedKeys.length,
    coverage: `${coverage}%`,
    newKeysCount: newKeys.length,
    newKeysList: newKeys.map(k => ({ key: k, en: upstreamDict[k] })),
    staleKeysCount: staleKeys.length,
    staleKeysList: staleKeys,
    jsPatchesStatus
  };

  return report;
}

if (require.main === module) {
  console.log('=== Claude 客户端版本漂移检测 (Drift Detection) ===\n');
  const report = runDriftDetection(process.argv[2]);

  console.log(`📡 目标源文件: ${report.sourceFile}`);
  console.log(`📊 官方词条总量: ${report.totalUpstreamKeys}`);
  console.log(`🇨🇳 当前词条收录率 (含保留英文术语): ${report.coverage} (${report.matchedKeysCount} / ${report.totalUpstreamKeys})`);
  console.log(`✨ 新增未汉化词条: ${report.newKeysCount}`);
  console.log(`🗑️ 历史陈旧废弃词条: ${report.staleKeysCount}`);

  if (report.jsPatchesStatus && report.jsPatchesStatus.length > 0) {
    console.log(`\n🛡️ JS 硬编码补丁守卫状态 (${report.jsPatchesStatus.length} 项):`);
    report.jsPatchesStatus.forEach(item => {
      const icon = item.healthy ? '✅' : '⚠️ [漂移告警]';
      console.log(`  ${icon} [${item.id}]: ${item.description} (${item.status})`);
    });
  }
  console.log('');

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
