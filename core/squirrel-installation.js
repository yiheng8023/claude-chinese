const fs = require('node:fs');
const path = require('node:path');

const releaseEntry = /^[a-f\d]{40}\s+AnthropicClaude-(\d+\.\d+\.\d+(?:\.\d+)?)-(?:full|delta)\.nupkg\s+\d+\s*$/i;

function newestFirst(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 4; i++) {
    const difference = (right[i] ?? 0) - (left[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

// Squirrel's launch entry selects an installed app directory from its local
// release index. An unindexed app-* folder may be an unfinished update.
function detectSquirrel(root) {
  const updatePath = path.join(root, 'Update.exe');
  if (!fs.statSync(updatePath, { throwIfNoEntry: false })?.isFile()) return null;
  const index = path.join(root, 'packages', 'RELEASES');
  if (!fs.statSync(index, { throwIfNoEntry: false })?.isFile()) return null;
  const releases = [...new Set(fs.readFileSync(index, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map(line => releaseEntry.exec(line)?.[1]).filter(Boolean))].sort(newestFirst);
  if (!releases.length) return null;
  const version = releases.find(release =>
    fs.statSync(path.join(root, `app-${release}`), { throwIfNoEntry: false })?.isDirectory());
  const info = { type: 'win32', distribution: 'website', squirrelRoot: root, installPath: root };
  if (!version) return { ...info, error: '未找到 Squirrel 已登记的 Claude 版本目录。' };
  const installPath = path.join(root, `app-${version}`);
  const resourcesPath = path.join(installPath, 'resources');
  if (!fs.statSync(path.join(installPath, 'Claude.exe'), { throwIfNoEntry: false })?.isFile() ||
      !fs.statSync(resourcesPath, { throwIfNoEntry: false })?.isDirectory()) {
    return { ...info, version, installPath, error: 'Squirrel 已登记的最新 Claude 版本文件不完整。' };
  }
  return { ...info, version, installPath, resourcesPath };
}

module.exports = { detectSquirrel };
