/** Bind the reviewed help-body snapshot to the original installed schema. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const { getClaudeInstallation } = require('../core/msix-detector');
const { baselineArtifacts, readMeta } = require('../core/asar-transaction');
const fixtures = [require('../test/fixtures/inference-help-4.4212.json'), require('../test/fixtures/inference-help-4.16336.json'), require('../test/fixtures/inference-help-4.23118.json'), require('../test/fixtures/inference-help-5.1231.json'), require('../test/fixtures/inference-help-5.11492.json')];
const translations = require('../dict/long-docs-zh-CN.json');

function auditInferenceHelp(info = getClaudeInstallation()) {
  const documents = [...new Set(fixtures.flatMap(fixture => fixture.documents))];
  const missing = documents.filter(text => !Object.hasOwn(translations, text));
  if (missing.length) throw Error(`当前折叠正文快照有 ${missing.length} 篇缺少完整译文。`);
  const archive = info.resourcesPath && path.join(info.resourcesPath, 'ion-dist.asar');
  if (!archive || !fs.existsSync(archive)) return { scope: 'fixture-only', bodies: documents.length, installedSchemaChecked: false };
  const source = baselineArtifacts(info.resourcesPath, readMeta(info.resourcesPath)).find(item => item.name === 'ion-dist.asar').source;
  asar.uncacheAll();
  for (const fixture of fixtures) {
    const matches = fixture.sourceFiles.every(record => {
      try {
        const bytes = asar.extractFile(source, record.file.split('/').join(path.sep));
        return crypto.createHash('sha256').update(bytes).digest('hex') === record.sha256;
      } catch { return false; }
    });
    if (matches) return { scope: 'installed-client-original-schema', bodies: fixture.documents.length, installedSchemaChecked: true, clientVersion: info.version, reviewedVersion: fixture.clientVersion };
  }
  throw Error('当前客户端的折叠说明源码与已审核快照不一致，请重新提取并审核正文。');
}

if (require.main === module) {
  try { console.log(JSON.stringify(auditInferenceHelp(), null, 2)); }
  catch (error) { console.error(`折叠说明检查失败: ${error.message}`); process.exitCode = 1; }
}
module.exports = { auditInferenceHelp };
