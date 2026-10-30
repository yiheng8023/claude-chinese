const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const { readMeta, baselineArtifacts, integrityRecords } = require('./asar-transaction');

/** Read the matching installed English catalog, including current ASAR layouts. */
function readOfficialCatalog(info, layer = 'ion') {
  if (!info?.resourcesPath) return null;
  const resources = info.resourcesPath;
  const archiveName = layer === 'shell' ? 'app.asar' : 'ion-dist.asar';
  const entry = layer === 'shell' ? path.join('resources', 'i18n', 'en-US.json') :
    layer === 'dynamic' ? path.join('i18n', 'dynamic', 'en-US.json') : path.join('i18n', 'en-US.json');
  let archive = path.join(resources, archiveName);
  if (fs.existsSync(archive)) {
    const meta = readMeta(resources);
    // Older releases overwrote en-US; only use a coherent original backup set.
    if (info.isPatched && meta.mode === 'asar_repack' && !meta.archives) {
      const baseline = baselineArtifacts(resources, meta);
      const item = baseline.find(item => item.name === archiveName);
      const exe = baseline.find(item => item.name === 'claude.exe');
      if (item) archive = item.source;
      if (exe) {
        const records = integrityRecords(exe.source);
        const crypto = require('node:crypto');
        asar.uncacheAll();
        const actual = crypto.createHash('sha256').update(asar.getRawHeader(archive).headerString).digest('hex');
        if (records[archiveName] !== actual) throw new Error('英文基线备份完整性不匹配。');
      }
    }
    asar.uncacheAll();
    return { dictionary: JSON.parse(asar.extractFile(archive, entry).toString('utf8')), source: `${archive} [${entry}]`, scope: 'installed-client' };
  }
  const file = layer === 'shell' ? path.join(resources, 'en-US.json') : path.join(resources, 'ion-dist', entry);
  return fs.existsSync(file) ? { dictionary: JSON.parse(fs.readFileSync(file, 'utf8')), source: file, scope: 'installed-client' } : null;
}

module.exports = { readOfficialCatalog };
