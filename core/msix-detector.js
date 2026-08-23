/**
 * Claude 安装路径与 MSIX/Win32/macOS/Linux 全平台探测器 (精准状态判定)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getClaudeInstallation(customPath = null) {
  const result = {
    platform: process.platform,
    type: 'unknown',
    version: null,
    installPath: null,
    resourcesPath: null,
    isPatched: false,
    packageFamilyName: null
  };

  // 0. 支持用户手动指定路径
  if (customPath && fs.existsSync(customPath)) {
    result.type = 'custom';
    result.installPath = customPath;
    if (fs.existsSync(path.join(customPath, 'resources'))) {
      result.resourcesPath = path.join(customPath, 'resources');
    } else if (fs.existsSync(path.join(customPath, 'app', 'resources'))) {
      result.resourcesPath = path.join(customPath, 'app', 'resources');
    } else if (fs.existsSync(path.join(customPath, 'Contents', 'Resources'))) {
      result.resourcesPath = path.join(customPath, 'Contents', 'Resources');
    } else {
      result.resourcesPath = customPath;
    }
  } else if (process.platform === 'win32') {
    // 1. 优先检测 Windows MSIX / Appx 安装
    try {
      const output = execSync('powershell -NoProfile -Command "Get-AppxPackage -Name *Claude* | Select-Object -First 1 -Property PackageFullName, InstallLocation, Version, PackageFamilyName | ConvertTo-Json"', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();

      if (output) {
        const pkg = JSON.parse(output);
        if (pkg && pkg.InstallLocation && fs.existsSync(pkg.InstallLocation)) {
          result.type = 'msix';
          result.version = pkg.Version;
          result.installPath = pkg.InstallLocation;
          result.packageFamilyName = pkg.PackageFamilyName;
          
          const resPath = path.join(pkg.InstallLocation, 'app', 'resources');
          if (fs.existsSync(resPath)) {
            result.resourcesPath = resPath;
          }
        }
      }
    } catch (e) {
      // 忽略 PowerShell 错误，继续检测 Win32 路径
    }

    // 2. 检测标准 Win32 / Squirrel 安装路径 (%LOCALAPPDATA%\Programs\Claude)
    if (!result.installPath) {
      const win32Path = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Claude');
      if (fs.existsSync(win32Path)) {
        result.type = 'win32';
        result.installPath = win32Path;
        const resPath = path.join(win32Path, 'resources');
        if (fs.existsSync(resPath)) {
          result.resourcesPath = resPath;
        }
      }
    }
  } else if (process.platform === 'darwin') {
    // 3. macOS 检测 (/Applications/Claude.app)
    const macPath = '/Applications/Claude.app';
    if (fs.existsSync(macPath)) {
      result.type = 'macos';
      result.installPath = macPath;
      const resPath = path.join(macPath, 'Contents', 'Resources');
      if (fs.existsSync(resPath)) {
        result.resourcesPath = resPath;
      }
    }
  } else if (process.platform === 'linux') {
    // 4. Linux 常见路径探测
    const linuxCandidates = [
      '/usr/lib/claude-desktop/resources',
      '/usr/share/claude-desktop/resources',
      '/opt/Claude/resources',
      '/opt/claude-desktop/resources',
      path.join(process.env.HOME || '', '.local/share/claude-desktop/resources')
    ];

    for (const cand of linuxCandidates) {
      if (fs.existsSync(cand)) {
        result.type = 'linux';
        result.installPath = path.dirname(cand);
        result.resourcesPath = cand;
        break;
      }
    }
  }

  // 5. 检查是否已汉化及是否官方已原生支持中文 (严谨特征判定)
  if (result.resourcesPath) {
    const metaPath = path.join(result.resourcesPath, '.claude_chinese_meta.json');
    const zhPath = path.join(result.resourcesPath, 'zh-CN.json');
    const ionZhPath = path.join(result.resourcesPath, 'ion-dist', 'i18n', 'zh-CN.json');
    const enUsPath = path.join(result.resourcesPath, 'ion-dist', 'i18n', 'en-US.json');

    // 官方原生支持判定：官方自身随安装包分发了 ion-dist/i18n/zh-CN.json，且未打过我们的元数据补丁，且包含官方完整词典结构
    let isOfficialNative = false;
    if (!fs.existsSync(metaPath) && fs.existsSync(ionZhPath) && fs.existsSync(enUsPath)) {
      try {
        const statZh = fs.statSync(ionZhPath);
        const statEn = fs.statSync(enUsPath);
        // 如果官方原生分发的 zh-CN.json 词条规模与 en-US.json 相当
        if (statZh.size > 50000 && statZh.size >= statEn.size * 0.5) {
          isOfficialNative = true;
        }
      } catch (e) {}
    }

    result.hasNativeChinese = isOfficialNative;
    result.isPatched = fs.existsSync(metaPath) || (fs.existsSync(zhPath) && fs.existsSync(ionZhPath));
  }

  return result;
}

module.exports = {
  getClaudeInstallation
};
