/**
 * 核心全量注入器与还原引擎 (支持增量挂载兜底、官方原版 en-US 零侵入保护、官方中文自动检测与优雅让位)
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('./msix-detector');
const { canWriteDirectory, grantPermissions } = require('./permissions');

function applyPatch(options = {}) {
  const info = getClaudeInstallation(options.customPath);

  if (!info.installPath || !info.resourcesPath) {
    return {
      success: false,
      error: '未找到 Claude 客户端安装路径。请确保已安装 Claude Desktop。'
    };
  }

  // 1. 官方中文自动检测与优雅让位机制 (Native Chinese Auto-Detection & Graceful Yield)
  if (info.hasNativeChinese) {
    return {
      success: true,
      nativeSupported: true,
      message: '🎉 检测到 Anthropic 官方已原生内置简体中文支持！工具包自动优雅让位，无需重复注入。',
      info
    };
  }

  const resDir = info.resourcesPath;
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');
  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');

  // 2. 检查并提权
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
    // 3. 补丁 JS 资源：注册 zh-CN 语言支持
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

    // 4. 增量挂载字典文件 (保留官方原版 en-US.json 100% 纯净作为终极兜底，不直接覆盖 en-US)
    const shellZhPath = path.join(__dirname, '../dict/zh-CN.json');
    const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
    const dynZhPath = path.join(__dirname, '../dict/dynamic-zh-CN.json');

    const shellZh = fs.existsSync(shellZhPath) ? JSON.parse(fs.readFileSync(shellZhPath, 'utf8')) : {};
    const ionZh = fs.existsSync(ionZhPath) ? JSON.parse(fs.readFileSync(ionZhPath, 'utf8')) : {};
    const dynZh = fs.existsSync(dynZhPath) ? JSON.parse(fs.readFileSync(dynZhPath, 'utf8')) : {};

    // 辅助函数：基于官方当前 en-US.json 进行增量合并，生成目标 zh-CN.json
    const createIncrementalZh = (targetDir, zhDict) => {
      const enPath = path.join(targetDir, 'en-US.json');
      const bakPath = path.join(targetDir, 'en-US.backup.json');
      let baseEn = {};

      // 优先从纯净备份或当前官方 en-US 读取基底
      if (fs.existsSync(bakPath)) {
        try { baseEn = JSON.parse(fs.readFileSync(bakPath, 'utf8')); } catch (e) {}
      } else if (fs.existsSync(enPath)) {
        try { baseEn = JSON.parse(fs.readFileSync(enPath, 'utf8')); } catch (e) {}
      }

      // 增量合并：官方未翻译词条保留英文作为兜底，已翻译词条精准替换
      const merged = Object.assign({}, baseEn, zhDict);
      fs.writeFileSync(path.join(targetDir, 'zh-CN.json'), JSON.stringify(merged, null, 2), 'utf8');
    };

    // A. 注入 Shell 层 zh-CN.json
    createIncrementalZh(resDir, shellZh);

    // B. 注入 Ion-Dist Web UI 层 zh-CN.json + zh-CN.overrides.json
    if (fs.existsSync(i18nDir)) {
      createIncrementalZh(i18nDir, ionZh);
      fs.writeFileSync(path.join(i18nDir, 'zh-CN.overrides.json'), '{}\n', 'utf8');
    }

    // C. 注入 Dynamic 层 zh-CN.json
    if (fs.existsSync(dynDir)) {
      createIncrementalZh(dynDir, dynZh);
    }

    // 5. 如果历史遗留的 en-US 曾被覆盖为中文，还原为纯净英文基线
    const sanitizeEnUS = (targetDir, fallbackBase) => {
      const enPath = path.join(targetDir, 'en-US.json');
      const bakPath = path.join(targetDir, 'en-US.backup.json');

      if (fs.existsSync(bakPath)) {
        fs.copyFileSync(bakPath, enPath);
      } else if (fs.existsSync(enPath)) {
        const content = fs.readFileSync(enPath, 'utf8');
        if (content.includes('实际大小') || content.includes('新对话') || content.includes('团队 (Team)')) {
          if (fallbackBase && fs.existsSync(fallbackBase)) {
            fs.copyFileSync(fallbackBase, enPath);
          }
        }
      }
    };

    sanitizeEnUS(resDir, path.join(__dirname, '../dict/en-US.base.json'));

    // 6. 写入元数据
    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
    const meta = {
      patchedAt: new Date().toISOString(),
      version: info.version,
      type: info.type,
      jsPatchedCount,
      totalEntries: Object.keys(ionZh).length,
      mode: 'incremental_overlay'
    };
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf8');

    return {
      success: true,
      info: {
        version: info.version,
        type: info.type,
        resourcesPath: resDir,
        entriesCount: meta.totalEntries,
        jsPatchedCount,
        mode: 'incremental_overlay'
      }
    };
  } catch (err) {
    return {
      success: false,
      error: `注入过程中发生异常: ${err.message}`
    };
  }
}

function restorePatch(options = {}) {
  const info = getClaudeInstallation(options.customPath);

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
    // 1. 恢复官方原版 en-US.json
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
