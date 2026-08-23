/**
 * 核心注入器与还原引擎
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('./msix-detector');
const { canWriteDirectory, grantPermissions } = require('./permissions');

function applyPatch(options = {}) {
  const info = getClaudeInstallation();

  if (!info.installPath || !info.resourcesPath) {
    return {
      success: false,
      error: '未找到 Claude 客户端安装路径。请确保已安装 Claude Desktop。'
    };
  }

  const resDir = info.resourcesPath;
  const enFile = path.join(resDir, 'en-US.json');
  const backupFile = path.join(resDir, 'en-US.backup.json');
  const metaFile = path.join(resDir, '.claude_chinese_meta.json');
  const zhSrc = path.join(__dirname, '../dict/zh-CN.json');

  if (!fs.existsSync(zhSrc)) {
    return {
      success: false,
      error: '汉化字典 dict/zh-CN.json 不存在，请先执行编译。'
    };
  }

  // 检查写权限，必要时尝试提权
  if (!canWriteDirectory(resDir)) {
    console.log('正在适配 Windows 目录权限 (WindowsApps / ACL)...');
    grantPermissions(resDir);
    if (!canWriteDirectory(resDir)) {
      return {
        success: false,
        error: '目录写权限不足。请以管理员身份运行（右键选择“以管理员身份运行”）。'
      };
    }
  }

  try {
    // 1. 备份原始 en-US.json
    if (fs.existsSync(enFile) && !fs.existsSync(backupFile)) {
      fs.copyFileSync(enFile, backupFile);
    }

    // 2. 覆盖注入中文 en-US.json
    const zhContent = fs.readFileSync(zhSrc, 'utf8');
    fs.writeFileSync(enFile, zhContent, 'utf8');

    // 3. 同时写入 zh-CN.json 备用
    const zhFile = path.join(resDir, 'zh-CN.json');
    fs.writeFileSync(zhFile, zhContent, 'utf8');

    // 4. 写入元数据标记
    const meta = {
      patchedAt: new Date().toISOString(),
      version: info.version,
      type: info.type,
      entriesCount: Object.keys(JSON.parse(zhContent)).length
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    return {
      success: true,
      info: {
        version: info.version,
        type: info.type,
        resourcesPath: resDir,
        entriesCount: meta.entriesCount
      }
    };
  } catch (err) {
    return {
      success: false,
      error: `注入过程中发生异常: ${err.message}`
    };
  }
}

function restorePatch() {
  const info = getClaudeInstallation();

  if (!info.installPath || !info.resourcesPath) {
    return {
      success: false,
      error: '未找到 Claude 客户端安装路径。'
    };
  }

  const resDir = info.resourcesPath;
  const enFile = path.join(resDir, 'en-US.json');
  const backupFile = path.join(resDir, 'en-US.backup.json');
  const metaFile = path.join(resDir, '.claude_chinese_meta.json');
  const baseEn = path.join(__dirname, '../dict/en-US.base.json');

  if (!canWriteDirectory(resDir)) {
    grantPermissions(resDir);
    if (!canWriteDirectory(resDir)) {
      return {
        success: false,
        error: '目录写权限不足，请以管理员身份运行。'
      };
    }
  }

  try {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, enFile);
      fs.unlinkSync(backupFile);
    } else if (fs.existsSync(baseEn)) {
      fs.copyFileSync(baseEn, enFile);
    }

    if (fs.existsSync(metaFile)) {
      fs.unlinkSync(metaFile);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `还原失败: ${err.message}`
    };
  }
}

module.exports = {
  applyPatch,
  restorePatch
};
