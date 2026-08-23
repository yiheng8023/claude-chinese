/**
 * 核心全量注入器与还原引擎 (支持 Shell + Ion-Dist Web UI 双层注入)
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('./msix-detector');
const { canWriteDirectory, grantPermissions } = require('./permissions');

function safeCopyOrMerge(sourceFile, targetFile, backupFile) {
  if (!fs.existsSync(targetFile)) return false;

  // 1. 创建备份
  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(targetFile, backupFile);
  }

  // 2. 读取原始目标 JSON 与中文字典
  const originalJson = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const zhJson = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

  // 3. 智能合并：以原始英文为基底，将中文词条覆盖进去，确保格式和结构 100% 合法
  const merged = Object.assign({}, originalJson, zhJson);

  fs.writeFileSync(targetFile, JSON.stringify(merged, null, 2), 'utf8');
  return true;
}

function applyPatch(options = {}) {
  const info = getClaudeInstallation();

  if (!info.installPath || !info.resourcesPath) {
    return {
      success: false,
      error: '未找到 Claude 客户端安装路径。请确保已安装 Claude Desktop。'
    };
  }

  const resDir = info.resourcesPath;
  const ionDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(ionDir, 'dynamic');

  // 检查并提权
  if (!canWriteDirectory(resDir)) {
    grantPermissions(resDir);
    if (!canWriteDirectory(resDir)) {
      return {
        success: false,
        error: '目录写权限不足。请以管理员身份运行。'
      };
    }
  }

  try {
    let patchedCount = 0;

    // 1. 注入 Shell 层 (en-US.json - 550 条)
    const shellZh = path.join(__dirname, '../dict/zh-CN.json');
    const shellEn = path.join(resDir, 'en-US.json');
    const shellBackup = path.join(resDir, 'en-US.backup.json');
    if (fs.existsSync(shellZh) && fs.existsSync(shellEn)) {
      safeCopyOrMerge(shellZh, shellEn, shellBackup);
      patchedCount += Object.keys(JSON.parse(fs.readFileSync(shellZh, 'utf8'))).length;
    }

    // 2. 注入 Web UI 层 (ion-dist/i18n/en-US.json - 21945 条)
    const ionZh = path.join(__dirname, '../dict/ion-zh-CN.json');
    const ionEn = path.join(ionDir, 'en-US.json');
    const ionBackup = path.join(ionDir, 'en-US.backup.json');
    if (fs.existsSync(ionZh) && fs.existsSync(ionEn)) {
      safeCopyOrMerge(ionZh, ionEn, ionBackup);
      patchedCount += Object.keys(JSON.parse(fs.readFileSync(ionZh, 'utf8'))).length;
    }

    // 3. 注入 Dynamic 层 (ion-dist/i18n/dynamic/en-US.json - 47 条)
    const dynZh = path.join(__dirname, '../dict/dynamic-zh-CN.json');
    const dynEn = path.join(dynDir, 'en-US.json');
    const dynBackup = path.join(dynDir, 'en-US.backup.json');
    if (fs.existsSync(dynZh) && fs.existsSync(dynEn)) {
      safeCopyOrMerge(dynZh, dynEn, dynBackup);
      patchedCount += Object.keys(JSON.parse(fs.readFileSync(dynZh, 'utf8'))).length;
    }

    // 4. 写入元数据
    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
    const meta = {
      patchedAt: new Date().toISOString(),
      version: info.version,
      type: info.type,
      totalPatchedEntries: patchedCount
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    return {
      success: true,
      info: {
        version: info.version,
        type: info.type,
        resourcesPath: resDir,
        entriesCount: patchedCount
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
  const targets = [
    { target: path.join(resDir, 'en-US.json'), backup: path.join(resDir, 'en-US.backup.json') },
    { target: path.join(resDir, 'ion-dist', 'i18n', 'en-US.json'), backup: path.join(resDir, 'ion-dist', 'i18n', 'en-US.backup.json') },
    { target: path.join(resDir, 'ion-dist', 'i18n', 'dynamic', 'en-US.json'), backup: path.join(resDir, 'ion-dist', 'i18n', 'dynamic', 'en-US.backup.json') }
  ];

  if (!canWriteDirectory(resDir)) {
    grantPermissions(resDir);
  }

  try {
    for (const t of targets) {
      if (fs.existsSync(t.backup)) {
        fs.copyFileSync(t.backup, t.target);
        fs.unlinkSync(t.backup);
      }
    }

    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
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
