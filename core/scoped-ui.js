/** Exact, reviewed source contexts. Never translate runtime/user string values. */
const path = require('node:path');
const records = require('../dict/scoped-ui-zh-CN.json');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const scopedSourceFiles = record => [record.file, ...(record.additionalFiles || [])];
const scopedUiPatches = records.map((record, index) => ({
  id: `scoped-ui-${index + 1}`,
  description: `界面限定文案: ${record.english}`,
  files: scopedSourceFiles(record).map(file => path.posix.basename(file)),
  enGuard: record.before,
  enPattern: new RegExp(escape(record.before), 'g'),
  zhSnippet: () => record.after,
  zhGuard: record.after,
  zhPattern: new RegExp(escape(record.after), 'g'),
  restoreEn: () => record.before
}));
const matchesFile = (patch, file) => !patch.files || patch.files.includes(file);
module.exports = { scopedUiPatches, matchesFile, scopedSourceFiles };
