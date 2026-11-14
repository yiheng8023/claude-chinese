const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const { getClaudeInstallation } = require('../core/msix-detector');
const { baselineArtifacts, readMeta } = require('../core/asar-transaction');
const { validateReview, validateSources } = require('./ui-coverage');
const review = require('../test/fixtures/desktop-ui-5.11492.json');
const translated = require('../dict/ion-zh-CN.json');

function auditUiCoverage(info = getClaudeInstallation()) {
  const counts = validateReview(review, translated);
  if (!info.resourcesPath || !fs.existsSync(path.join(info.resourcesPath, 'ion-dist.asar'))) {
    return { scope: 'reviewed-fixture-only', ...counts, installedSourceChecked: false };
  }
  const source = baselineArtifacts(info.resourcesPath, readMeta(info.resourcesPath)).find(x => x.name === 'ion-dist.asar').source;
  asar.uncacheAll();
  const read = file => asar.extractFile(source, path.normalize(file)).toString('utf8');
  validateSources(review, read, JSON.parse(read('i18n/en-US.json')));
  for (const record of require('../dict/scoped-ui-zh-CN.json')) {
    if (!review.sourceFiles.some(file => file.file === record.file)) throw Error(`Unreviewed literal module: ${record.file}`);
    if (!read(record.file).includes(record.before)) throw Error(`Scoped UI literal changed: ${record.english}`);
  }
  return { scope: 'reviewed-desktop-modules', ...counts, clientVersion: info.version, installedSourceChecked: true };
}
if (require.main === module) {
  try { console.log(JSON.stringify(auditUiCoverage(), null, 2)); }
  catch (error) { console.error(`UI coverage: ${error.message}`); process.exitCode = 1; }
}
module.exports = { auditUiCoverage };
