const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function createLaunchShortcut(output, options = {}) {
  if (process.platform !== 'win32') throw new Error('快捷方式命令仅支持 Windows。');
  const destination = path.resolve(output);
  if (path.extname(destination).toLowerCase() !== '.lnk') throw new Error('快捷方式输出必须是 .lnk 文件。');
  if (!fs.existsSync(path.dirname(destination))) throw new Error('快捷方式输出目录不存在。');
  // IShellLinkW expands existing 8.3 aliases when reading the target back.
  const root = fs.realpathSync.native(path.resolve(__dirname, '..'));
  const target = path.join(root, 'launch.bat');
  const script = fs.readFileSync(path.join(__dirname, 'windows-shortcut.ps1'), 'utf8');
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    input: JSON.stringify({ output: destination, target, root, backup: options.backup !== false }), encoding: 'utf8', windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  }));
}

module.exports = { createLaunchShortcut };
