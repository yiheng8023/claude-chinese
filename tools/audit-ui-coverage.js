const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const { getClaudeInstallation } = require('../core/msix-detector');
const { baselineArtifacts, readMeta } = require('../core/asar-transaction');
const { validateReview, validateSources } = require('./ui-coverage');
const { scopedSourceFiles } = require('../core/scoped-ui');
const previous = require('../test/fixtures/desktop-ui-5.11492.json');
const current = require('../test/fixtures/desktop-ui-6.6395.json');
const translated = require('../dict/ion-zh-CN.json');
const messages = { ...previous.messages, ...current.messages };
const currentReview = { ...current, messages: Object.fromEntries(
  [...new Set(current.sourceFiles.flatMap(file => file.ids))].map(id => [id, messages[id]])
) };
const reviews = [currentReview, previous];

function auditUiCoverage(info = getClaudeInstallation()) {
  const counts = reviews.map(review => validateReview(review, translated));
  const reviewedFiles = new Set(reviews.flatMap(review => review.sourceFiles.map(record => record.file)));
  const scoped = require('../dict/scoped-ui-zh-CN.json');
  for (const record of scoped) {
    for (const file of scopedSourceFiles(record)) {
      if (!reviewedFiles.has(file)) throw Error(`Unreviewed literal module: ${file}`);
    }
  }
  if (!info.resourcesPath || !fs.existsSync(path.join(info.resourcesPath, 'ion-dist.asar'))) {
    return { scope: 'reviewed-fixture-only', ...counts[0], installedSourceChecked: false };
  }
  const index = reviews.findIndex(review => review.clientVersion === info.version ||
    review.clientVersion === `${info.version}.0`);
  if (index < 0) throw Error(`No UI review for installed client ${info.version || '(unknown version)'}`);
  const review = reviews[index];
  const source = baselineArtifacts(info.resourcesPath, readMeta(info.resourcesPath)).find(x => x.name === 'ion-dist.asar').source;
  asar.uncacheAll();
  const read = file => asar.extractFile(source, path.normalize(file)).toString('utf8');
  validateSources(review, read, JSON.parse(read('i18n/en-US.json')));
  const currentFiles = new Set(review.sourceFiles.map(record => record.file));
  for (const record of scoped) {
    for (const file of scopedSourceFiles(record)) {
      if (currentFiles.has(file) && !read(file).includes(record.before)) throw Error(`Scoped UI literal changed: ${record.english}`);
    }
  }
  return { scope: 'reviewed-desktop-modules', ...counts[index], clientVersion: info.version, installedSourceChecked: true };
}
if (require.main === module) {
  try { console.log(JSON.stringify(auditUiCoverage(), null, 2)); }
  catch (error) { console.error(`UI coverage: ${error.message}`); process.exitCode = 1; }
}
module.exports = { auditUiCoverage };
