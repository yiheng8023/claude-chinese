/**
 * Claude 安装路径与 MSIX/Win32/macOS/Linux 全平台探测器
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

  // 5. 检查是否已汉化
  if (result.resourcesPath) {
    const enPath = path.join(result.resourcesPath, 'en-US.json');
    const metaPath = path.join(result.resourcesPath, '.claude_chinese_meta.json');
    if (fs.existsSync(metaPath)) {
      result.isPatched = true;
    } else if (fs.existsSync(enPath)) {
      try {
        const content = fs.readFileSync(enPath, 'utf8');
        if (content.includes('实际大小') || content.includes('新对话') || content.includes('团队 (Team)')) {
          result.isPatched = true;
        }
      } catch (e) {}
    }
  }

  return result;
}

module.exports = {
  getClaudeInstallation
};
