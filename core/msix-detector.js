/**
 * Claude 安装路径与 MSIX/Win32/macOS 包探测器
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getClaudeInstallation() {
  const result = {
    platform: process.platform,
    type: 'unknown',
    version: null,
    installPath: null,
    resourcesPath: null,
    isPatched: false,
    packageFamilyName: null
  };

  if (process.platform === 'win32') {
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
  }

  // 4. 检查是否已汉化
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
