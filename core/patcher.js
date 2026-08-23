/**
 * 核心全量注入器与还原引擎 (支持 Shell + Ion-Dist Web UI + JS 语言注册补丁与完整还原闭环)
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
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');
  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');

  // 1. 检查并提权
  if (!canWriteDirectory(resDir)) {
    grantPermissions(resDir);
    grantPermissions(path.join(resDir, 'ion-dist'));
    grantPermissions(assetsDir);
    grantPermissions(i18nDir);
    if (!canWriteDirectory(resDir)) {
      return {
        success: false,
        error: '目录写权限不足。请以管理员身份运行。'
      };
    }
  }

  try {
    // 2. 补丁 JS 资源：注册 zh-CN 语言支持
    let jsPatchedCount = 0;
    if (fs.existsSync(assetsDir)) {
      const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
      const regexAdd = /((?:[\w$]+)=\["en-US"(?:,"[^"]+")+\])/g;

      for (const file of jsFiles) {
        const fullPath = path.join(assetsDir, file);
        let content = fs.readFileSync(fullPath, 'utf8');

        if (content.includes('"en-US"') && !content.includes('"zh-CN"')) {
          if (regexAdd.test(content)) {
            content = content.replace(regexAdd, (match) => {
              return match.slice(0, -1) + ',"zh-CN"]';
            });
            fs.writeFileSync(fullPath, content, 'utf8');
            jsPatchedCount++;
          }
        }
      }
    }

    // 3. 自动创建官方原版 en-US 备份 (防止还原时丢失纯英文基线)
    const backupEnUS = (targetDir) => {
      const enFile = path.join(targetDir, 'en-US.json');
      const bakFile = path.join(targetDir, 'en-US.backup.json');
      if (fs.existsSync(enFile) && !fs.existsSync(bakFile)) {
        const content = fs.readFileSync(enFile, 'utf8');
        // 确保备份的是真正的英文原版（不含汉化特征词）
        if (!content.includes('实际大小') && !content.includes('新对话') && !content.includes('团队 (Team)')) {
          fs.copyFileSync(enFile, bakFile);
        }
      }
    };

    backupEnUS(resDir);
    if (fs.existsSync(i18nDir)) backupEnUS(i18nDir);
    if (fs.existsSync(dynDir)) backupEnUS(dynDir);

    // 4. 安装全量字典文件
    const shellZh = path.join(__dirname, '../dict/zh-CN.json');
    const ionZh = path.join(__dirname, '../dict/ion-zh-CN.json');
    const dynZh = path.join(__dirname, '../dict/dynamic-zh-CN.json');

    // 注入 Shell 层
    if (fs.existsSync(shellZh)) {
      fs.copyFileSync(shellZh, path.join(resDir, 'zh-CN.json'));
      fs.copyFileSync(shellZh, path.join(resDir, 'en-US.json'));
    }

    // 注入 Ion-Dist Web UI 层
    if (fs.existsSync(ionZh) && fs.existsSync(i18nDir)) {
      fs.copyFileSync(ionZh, path.join(i18nDir, 'zh-CN.json'));
      fs.copyFileSync(ionZh, path.join(i18nDir, 'en-US.json'));
      fs.writeFileSync(path.join(i18nDir, 'zh-CN.overrides.json'), '{}\n', 'utf8');
    }

    // 注入 Dynamic 层
    if (fs.existsSync(dynZh) && fs.existsSync(dynDir)) {
      fs.copyFileSync(dynZh, path.join(dynDir, 'zh-CN.json'));
      fs.copyFileSync(dynZh, path.join(dynDir, 'en-US.json'));
    }

    // 5. 写入元数据
    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
    const meta = {
      patchedAt: new Date().toISOString(),
      version: info.version,
      type: info.type,
      jsPatchedCount,
      totalEntries: 18960
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    return {
      success: true,
      info: {
        version: info.version,
        type: info.type,
        resourcesPath: resDir,
        entriesCount: meta.totalEntries,
        jsPatchedCount
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
  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');

  if (!canWriteDirectory(resDir)) {
    grantPermissions(resDir);
    grantPermissions(path.join(resDir, 'ion-dist'));
    grantPermissions(assetsDir);
  }

  try {
    // 1. 恢复官方原版 en-US.json (彻底闭环解决覆盖污染)
    const restoreEnUS = (targetDir, defaultBaseFile) => {
      const enFile = path.join(targetDir, 'en-US.json');
      const bakFile = path.join(targetDir, 'en-US.backup.json');

      if (fs.existsSync(bakFile)) {
        fs.copyFileSync(bakFile, enFile);
        fs.unlinkSync(bakFile);
      } else if (defaultBaseFile && fs.existsSync(defaultBaseFile)) {
        fs.copyFileSync(defaultBaseFile, enFile);
      }
    };

    const shellBase = path.join(__dirname, '../dict/en-US.base.json');
    restoreEnUS(resDir, shellBase);
    if (fs.existsSync(i18nDir)) restoreEnUS(i18nDir);
    if (fs.existsSync(dynDir)) restoreEnUS(dynDir);

    // 2. 移除注入的中文文件
    const filesToDelete = [
      path.join(resDir, 'zh-CN.json'),
      path.join(i18nDir, 'zh-CN.json'),
      path.join(i18nDir, 'zh-CN.overrides.json'),
      path.join(dynDir, 'zh-CN.json'),
      path.join(resDir, '.claude_chinese_meta.json')
    ];

    for (const f of filesToDelete) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    }

    // 3. 恢复 JS 注册中的 zh-CN
    if (fs.existsSync(assetsDir)) {
      const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
      for (const file of jsFiles) {
        const fullPath = path.join(assetsDir, file);
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(',"zh-CN"]')) {
          content = content.replace(',"zh-CN"]', ']');
          fs.writeFileSync(fullPath, content, 'utf8');
        }
      }
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
