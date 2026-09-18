/**
 * 上游多版本事前兼容矩阵与混淆变异碰撞测试引擎
 * (Upstream Pre-Release Compatibility Matrix & Mutation Fuzzing Harness)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { applyPatch, restorePatch, JS_LITERAL_PATCHES } = require('../core/patcher');
const { getClaudeInstallation } = require('../core/msix-detector');

function runCompatibilityMatrix(options = {}) {
  console.log('====================================================');
  console.log('   Claude-Chinese 上游事前兼容矩阵与混淆变异碰撞测试');
  console.log('====================================================\n');

  const report = {
    timestamp: new Date().toISOString(),
    metrics: {},
    mutationFuzzing: {},
    longDocsHealth: {},
    patchesHealth: {},
    allPassed: true
  };

  const info = getClaudeInstallation(options.customPath);
  const resDir = info.resourcesPath;

  if (!resDir || !fs.existsSync(resDir)) {
    console.log('⚠️ 未检测到已安装的客户端资源目录，使用基础 Mock 模式执行测试。');
  }

  // 1. 测试真实或沙盒环境中的 JS 硬编码补丁抗混淆拓扑命中
  console.log('【阶段 1】JS 硬编码补丁拓扑命中率矩阵 (Patch Hit Rate Matrix)');
  const assetsDir = resDir ? path.join(resDir, 'ion-dist', 'assets', 'v1') : null;
  let allJs = '';
  if (assetsDir && fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') && !f.endsWith('.orig.bak'));
    for (const f of files) {
      allJs += fs.readFileSync(path.join(assetsDir, f), 'utf8') + '\n';
    }
  }

  let activeHits = 0;
  let standardizedCount = 0;
  let missingCount = 0;

  for (const patch of JS_LITERAL_PATCHES) {
    let status = 'UNKNOWN';
    if (allJs) {
      if (patch.zhPattern && patch.zhPattern.test(allJs)) {
        status = 'ACTIVE_PATCHED';
        activeHits++;
      } else if (patch.enPattern && patch.enPattern.test(allJs)) {
        status = 'ACTIVE_READY';
        activeHits++;
      } else if (patch.intlKey) {
        status = 'UPSTREAM_STANDARDIZED';
        standardizedCount++;
      } else {
        status = 'MISSING_UNMATCHED';
        missingCount++;
        report.allPassed = false;
      }
    } else {
      status = patch.intlKey ? 'UPSTREAM_STANDARDIZED' : 'ACTIVE_SYNTHETIC';
      activeHits++;
    }

    report.patchesHealth[patch.id] = {
      description: patch.description,
      status
    };

    const icon = status === 'MISSING_UNMATCHED' ? '❌' : (status === 'UPSTREAM_STANDARDIZED' ? 'ℹ️' : '✅');
    console.log(`  ${icon} [${patch.id}]: ${patch.description} -> ${status}`);
  }

  // 2. 长文档拦截器多签名健康度检测
  console.log('\n【阶段 2】折叠长文档拦截器多签名自适应检测 (Long Docs Health Matrix)');
  const longDocsPath = path.join(__dirname, '../dict/long-docs-zh-CN.json');
  const longDocs = fs.existsSync(longDocsPath) ? JSON.parse(fs.readFileSync(longDocsPath, 'utf8')) : {};
  const totalLongDocs = Object.keys(longDocs).length;

  console.log(`  📊 当前收录长文档总数: ${totalLongDocs} 篇`);
  let zFnDetected = false;
  if (allJs) {
    const zFnMultiRegex = /function\s+([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)\{return\{text:\2,\.\.\.\3\}\}/;
    const hasHeader = allJs.includes('var __ZH_DOCS__=');
    if (hasHeader || zFnMultiRegex.test(allJs)) {
      zFnDetected = true;
      console.log('  ✅ 成功检测到长文档拦截锚点注入/可用状态！');
    } else {
      console.log('  ⚠️ 未直接匹配到默认长文档函数签名，进入变异模式检测...');
    }
  }

  // 3. 混淆变异碰撞模糊测试 (Mutation Fuzzing Harness)
  console.log('\n【阶段 3】抽象语法树与代码混淆变异碰撞测试 (Mutation Fuzzing Harness)');
  const mockSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-fuzzing-'));
  try {
    const fuzzedMockRes = path.join(mockSandbox, 'resources');
    const fuzzedAssets = path.join(fuzzedMockRes, 'ion-dist', 'assets', 'v1');
    const fuzzedI18n = path.join(fuzzedMockRes, 'ion-dist', 'i18n');
    fs.mkdirSync(fuzzedAssets, { recursive: true });
    fs.mkdirSync(fuzzedI18n, { recursive: true });

    // 变异场景 1: 函数声明式拓扑 + 打包器重命名变量名 (e,t -> _x9,_y9)
    const mutatedLongJs1 = 'function _aBc(_x9,_y9){return{text:_x9,..._y9}}';
    fs.writeFileSync(path.join(fuzzedAssets, 'mutated-long-decl.js'), mutatedLongJs1, 'utf8');

    // 变异场景 2: 箭头函数变异拓扑 (ESBuild/Webpack 箭头函数优化)
    const mutatedLongJs2 = '_fnArrow=(_arg1,_arg2)=>({text:_arg1,..._arg2})';
    fs.writeFileSync(path.join(fuzzedAssets, 'mutated-long-arrow.js'), mutatedLongJs2, 'utf8');

    // 变异场景 3: Object.assign 语法降级变异拓扑 (Babel/Terser 降级转换)
    const mutatedLongJs3 = 'function _fnAssign(_p1,_p2){return Object.assign({text:_p1},_p2)}';
    fs.writeFileSync(path.join(fuzzedAssets, 'mutated-long-assign.js'), mutatedLongJs3, 'utf8');

    // 变异场景 4: 思考强度下拉三元表达式混淆变量名
    const mutatedEffortJs = 'return{value:x1,label:fn(x2,cfg.meta.optionLabels?.[x1])??x1,disabled:false}';
    fs.writeFileSync(path.join(fuzzedAssets, 'mutated-effort.js'), mutatedEffortJs, 'utf8');

    // 写入基础 en-US.json
    fs.writeFileSync(path.join(fuzzedI18n, 'en-US.json'), '{}', 'utf8');

    // 执行模拟注入
    const fuzzedRes = applyPatch({ customPath: mockSandbox, autoClose: false });
    if (fuzzedRes.success) {
      console.log('  ✅ 变异变量名与混淆压缩沙盒测试: applyPatch 注入执行成功');
      const patchedLong1 = fs.readFileSync(path.join(fuzzedAssets, 'mutated-long-decl.js'), 'utf8');
      const patchedLong2 = fs.readFileSync(path.join(fuzzedAssets, 'mutated-long-arrow.js'), 'utf8');
      const patchedLong3 = fs.readFileSync(path.join(fuzzedAssets, 'mutated-long-assign.js'), 'utf8');
      const patchedEffort = fs.readFileSync(path.join(fuzzedAssets, 'mutated-effort.js'), 'utf8');

      const fuzz1Passed = patchedLong1.includes('__ZH_DOCS__') && patchedLong1.includes('function _aBc(_x9,_y9)');
      const fuzz2Passed = patchedLong2.includes('__ZH_DOCS__') && patchedLong2.includes('_fnArrow=(_arg1,_arg2)=>');
      const fuzz3Passed = patchedLong3.includes('__ZH_DOCS__') && patchedLong3.includes('function _fnAssign(_p1,_p2)');
      const effortFuzzPassed = patchedEffort.includes('_em');

      console.log(`  ${fuzz1Passed ? '✅' : '❌'} 长文档声明式变异抗混淆拓扑命中: ${fuzz1Passed ? 'PASS' : 'FAIL'}`);
      console.log(`  ${fuzz2Passed ? '✅' : '❌'} 长文档箭头函数变异抗混淆拓扑命中: ${fuzz2Passed ? 'PASS' : 'FAIL'}`);
      console.log(`  ${fuzz3Passed ? '✅' : '❌'} 长文档 Object.assign 降级抗混淆拓扑命中: ${fuzz3Passed ? 'PASS' : 'FAIL'}`);
      console.log(`  ${effortFuzzPassed ? '✅' : '❌'} 思考强度变量重命名抗混淆拓扑命中: ${effortFuzzPassed ? 'PASS' : 'FAIL'}`);

      report.mutationFuzzing = {
        declarationFuzz: fuzz1Passed,
        arrowFunctionFuzz: fuzz2Passed,
        assignFuzz: fuzz3Passed,
        effortFuzz: effortFuzzPassed
      };

      if (!fuzz1Passed || !fuzz2Passed || !fuzz3Passed || !effortFuzzPassed) {
        report.allPassed = false;
      }
    } else {
      console.error('  ❌ 变异沙盒测试执行失败:', fuzzedRes.error);
      report.allPassed = false;
    }
  } finally {
    if (fs.existsSync(mockSandbox)) {
      try { fs.rmSync(mockSandbox, { recursive: true, force: true }); } catch (e) {}
    }
  }

  // 4. 统计与终审报告
  console.log('\n====================================================');
  console.log(`兼容矩阵测试完成: 活跃补丁命中 ${activeHits} | 上游标准化 ${standardizedCount} | 脱靶未命中 ${missingCount}`);
  console.log(`综合健康判定: ${report.allPassed ? '🎉 100% PASS (事前兼容矩阵全线绿灯)' : '⚠️ 存在需要适配的变动'}`);
  console.log('====================================================\n');

  return report;
}

if (require.main === module) {
  const result = runCompatibilityMatrix();
  process.exit(result.allPassed ? 0 : 1);
}

module.exports = { runCompatibilityMatrix };
