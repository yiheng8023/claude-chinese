/** Exact, reviewed source contexts. Never translate runtime/user string values. */
const path = require('node:path');
const records = require('../dict/scoped-ui-zh-CN.json');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scopedUiPatches = records.map((record, index) => ({
  id: `scoped-ui-${index + 1}`,
  description: `界面限定文案: ${record.english}`,
  file: path.posix.basename(record.file),
  enGuard: record.before,
  enPattern: new RegExp(escape(record.before), 'g'),
  zhSnippet: () => record.after,
  zhGuard: record.after,
  zhPattern: new RegExp(escape(record.after), 'g'),
  restoreEn: () => record.before
}));
const matchesFile = (patch, file) => !patch.file || patch.file === file;
module.exports = { scopedUiPatches, matchesFile };
