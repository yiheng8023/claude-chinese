const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function registeredAppTarget(packageFamilyName) {
  if (!/^(Claude|AnthropicPBC\.Claude)_[a-z0-9]{13}$/.test(packageFamilyName || '')) {
    throw new Error('Windows 应用标识无效。');
  }
  return `shell:AppsFolder\\${packageFamilyName}!Claude`;
}

function createLaunchShortcut(output, options = {}) {
  if (process.platform !== 'win32') throw new Error('快捷方式命令仅支持 Windows。');
  const destination = path.resolve(output);
  if (path.extname(destination).toLowerCase() !== '.lnk') throw new Error('快捷方式输出必须是 .lnk 文件。');
  if (!fs.existsSync(path.dirname(destination))) throw new Error('快捷方式输出目录不存在。');
  const args = registeredAppTarget(options.packageFamilyName);
  const root = fs.realpathSync.native(process.env.SystemRoot);
  const target = path.join(root, 'explorer.exe');
  const script = fs.readFileSync(path.join(__dirname, 'windows-shortcut.ps1'), 'utf8');
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    input: JSON.stringify({ output: destination, target, root, args, backup: options.backup !== false }), encoding: 'utf8', windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  }));
}

module.exports = { registeredAppTarget, createLaunchShortcut };
