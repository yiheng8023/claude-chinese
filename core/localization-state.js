const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function localizationFingerprint() {
  const root = path.join(__dirname, '..');
  const hash = crypto.createHash('sha256');
  for (const name of ['zh-CN.json', 'ion-zh-CN.json', 'dynamic-zh-CN.json', 'long-docs-zh-CN.json']) {
    hash.update(name).update('\0').update(fs.readFileSync(path.join(root, 'dict', name))).update('\0');
  }
  return { toolkitVersion: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, dictionaryDigest: hash.digest('hex') };
}

module.exports = { localizationFingerprint };
