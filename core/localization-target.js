const fs = require('node:fs');
const path = require('node:path');

const protectedMessage = 'Windows 注册包由系统管理，汉化工具不会写入。可以指定 --path 指向已安装的 Squirrel 版根目录或独立测试副本。';

function localizationTargetError(info) {
  if (info.platform !== 'win32') return null;
  if (info.type === 'msix') return protectedMessage;
  if (!info.resourcesPath) return null;

  const exe = path.join(path.dirname(info.resourcesPath), 'Claude.exe');
  const targets = [info.installPath, info.resourcesPath, exe,
    path.join(info.resourcesPath, 'app.asar'), path.join(info.resourcesPath, 'ion-dist.asar')];
  for (const target of new Set(targets)) {
    if (!target || !fs.existsSync(target)) continue;
    const resolved = fs.realpathSync.native(target);
    if (resolved.split(/[\\/]/).some(part => part.toLowerCase() === 'windowsapps')) return protectedMessage;
    const stat = fs.statSync(target);
    if (stat.isFile() && (stat.nlink !== 1 || fs.lstatSync(target).isSymbolicLink())) {
      return '汉化目标包含链接到其他安装的文件。请使用逐文件复制的独立测试副本。';
    }
  }
  return null;
}

module.exports = { localizationTargetError };
