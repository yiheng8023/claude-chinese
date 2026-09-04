/**
 * 核心全量注入器与还原引擎 (支持增量挂载兜底、官方原版 en-US 零侵入保护、官方中文自动检测与优雅让位)
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('./msix-detector');
const { canWriteDirectory, grantPermissions } = require('./permissions');

const { execSync } = require('child_process');

function isClaudeRunning() {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      const stdout = execSync('tasklist /FI "IMAGENAME eq Claude.exe" /NH', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return stdout.toLowerCase().includes('claude.exe');
    } else {
      const stdout = execSync('pgrep -i claude || true', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return stdout.trim().length > 0;
    }
  } catch (e) {
    return false;
  }
}

function closeClaude() {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      execSync('taskkill /F /IM Claude.exe', { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      execSync('killall Claude || pkill -i Claude || true', { stdio: 'ignore' });
    } else {
      execSync('pkill -f claude || true', { stdio: 'ignore' });
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 官方未暴露 i18n key 的硬编码 UI 字符串补丁注册表
 * 配备可感知命中统计 (Hit Counter) 与漂移告警 (Drift Alert) 机制
 */
const JS_LITERAL_PATCHES = [
  {
    id: 'worktrees-location-default',
    description: 'Claude Code 工作树默认位置下拉选项',
    enPattern: /label:\s*["']Inside project \(\.claude\/worktrees\)["']/g,
    zhSnippet: 'label:"项目目录内 (.claude/worktrees)"',
    zhPattern: /label:\s*["']项目目录内 \(\.claude\/worktrees\)["']/g,
    restoreEn: 'label:"Inside project (.claude/worktrees)"'
  ,
    intlKey: 'eI3zYFFnpz'},
  {
    id: 'worktrees-location-custom',
    description: 'Claude Code 工作树自定义位置下拉选项',
    enPattern: /label:\s*["']Custom\.\.\.["']/g,
    zhSnippet: 'label:"自定义..."',
    zhPattern: /label:\s*["']自定义\.\.\.["']/g,
    restoreEn: 'label:"Custom..."'
  ,
    intlKey: 'lKjjJ7PIFW'},
  {
    id: 'sidebar-toggle-tooltip',
    description: '侧边栏收起/展开按钮提示词',
    enPattern: /content:([a-zA-Z0-9_$]+)\?"Expand sidebar":"Collapse sidebar"/g,
    zhSnippet: 'content:$1?"展开侧边栏":"收起侧边栏"',
    zhPattern: /content:([a-zA-Z0-9_$]+)\?"展开侧边栏":"收起侧边栏"/g,
    restoreEn: 'content:$1?"Expand sidebar":"Collapse sidebar"'
  ,
    intlKey: 'eOJ4QUCTXl'},
  {
    id: 'sidebar-toggle-aria',
    description: '侧边栏收起/展开无障碍标签',
    enPattern: /"aria-label":([a-zA-Z0-9_$]+)\?"Expand sidebar":"Collapse sidebar"/g,
    zhSnippet: '"aria-label":$1?"展开侧边栏":"收起侧边栏"',
    zhPattern: /"aria-label":([a-zA-Z0-9_$]+)\?"展开侧边栏":"收起侧边栏"/g,
    restoreEn: '"aria-label":$1?"Expand sidebar":"Collapse sidebar"'
  ,
    intlKey: '+G35mRWa75'},
  {
    id: 'sidebar-search-tooltip',
    description: '侧边栏搜索按钮提示词',
    enPattern: /content:"Search",shortcut:([a-zA-Z0-9_$]+),side:"bottom"/g,
    zhSnippet: 'content:"搜索",shortcut:$1,side:"bottom"',
    zhPattern: /content:"搜索",shortcut:([a-zA-Z0-9_$]+),side:"bottom"/g,
    restoreEn: 'content:"Search",shortcut:$1,side:"bottom"'
  ,
    intlKey: 'vFf4r9k1F2'},
  {
    id: 'filter-status-label',
    description: 'Code 模式侧边栏过滤菜单 Status 标签',
    enPattern: /label:"Status",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),active:"active"!==/g,
    zhSnippet: 'label:"状态",options:$1,value:$2,onChange:$3,active:"active"!==',
    zhPattern: /label:"状态",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),active:"active"!==/g,
    restoreEn: 'label:"Status",options:$1,value:$2,onChange:$3,active:"active"!=='
  ,
    intlKey: 'ku+mDU6MeW'},
  {
    id: 'filter-last-activity-label',
    description: 'Code 模式侧边栏过滤菜单 Last activity 标签',
    enPattern: /label:"Last activity",options:([a-zA-Z0-9_$]+),value:String\(([a-zA-Z0-9_$]+)\)/g,
    zhSnippet: 'label:"最近活动",options:$1,value:String($2)',
    zhPattern: /label:"最近活动",options:([a-zA-Z0-9_$]+),value:String\(([a-zA-Z0-9_$]+)\)/g,
    restoreEn: 'label:"Last activity",options:$1,value:String($2)'
  ,
    intlKey: 'FgG7d+eCOU'},
  {
    id: 'filter-show-empty-folders',
    description: '侧边栏过滤菜单显示空文件夹选项',
    enPattern: /children:"Show empty folders"/g,
    zhSnippet: 'children:"显示空文件夹"',
    zhPattern: /children:"显示空文件夹"/g,
    restoreEn: 'children:"Show empty folders"',
    intlKey: '3Jz2qrg77Q'
  },
  {
    id: 'filter-clear-filters',
    description: '侧边栏过滤菜单清除过滤器按钮',
    enPattern: /children:"Clear filters"/g,
    zhSnippet: 'children:"清除过滤器"',
    zhPattern: /children:"清除过滤器"/g,
    restoreEn: 'children:"Clear filters"',
    intlKey: '8sO4P8f1Fz'
  },
  {
    id: 'filter-options-yM',
    description: '侧边栏过滤状态选项 (活跃/已归档/全部)',
    enPattern: /\[\["active","Active"\],\["archived","Archived"\],\["all","All"\]\]/g,
    zhSnippet: '[["active","活跃"],["archived","已归档"],["all","全部"]]',
    zhPattern: /\[\["active","活跃"\],\["archived","已归档"\],\["all","全部"\]\]/g,
    restoreEn: '[["active","Active"],["archived","Archived"],["all","All"]]'
  ,
    intlKey: 'zQvVDJ+j59'},
  {
    id: 'filter-options-wM',
    description: '侧边栏排序选项 (按字母/创建时间/最近)',
    enPattern: /\[\["alpha","Alphabetically"\],\["created","Created time"\],\["recency","Recency"\]\]/g,
    zhSnippet: '[["alpha","按字母顺序"],["created","创建时间"],["recency","最近"]]',
    zhPattern: /\[\["alpha","按字母顺序"\],\["created","创建时间"\],\["recency","最近"\]\]/g,
    restoreEn: '[["alpha","Alphabetically"],["created","Created time"],["recency","Recency"]]'
  ,
    intlKey: 'Yjk5Ow/k5f'},
  {
    id: 'filter-options-group-by-code',
    description: 'Code 模式侧边栏分组选项 (日期/文件夹/状态/自定义/无)',
    enPattern: /return\[\["date","Date"\],\.\.\."code"===([a-zA-Z0-9_$]+)\?\[\["project","Folder"\]\]:\[\],\.\.\."code"===\1&&([a-zA-Z0-9_$]+)\?\[\["state","State"\]\]:\[\],\.\.\."code"===\1\?\[\["custom","Custom groups"\]\]:\[\],\["none","None"\]\]/g,
    zhSnippet: 'return[["date","日期"],..."code"===$1?[["project","文件夹"]]:[],..."code"===$1&&$2?[["state","状态"]]:[],..."code"===$1?[["custom","自定义分组"]]:[],["none","无"]]',
    zhPattern: /return\[\["date","日期"\],\.\.\."code"===([a-zA-Z0-9_$]+)\?\[\["project","文件夹"\]\]:\[\],\.\.\."code"===\1&&([a-zA-Z0-9_$]+)\?\[\["state","状态"\]\]:\[\],\.\.\."code"===\1\?\[\["custom","自定义分组"\]\]:\[\],\["none","无"\]\]/g,
    restoreEn: 'return[["date","Date"],..."code"===$1?[["project","Folder"]]:[],..."code"===$1&&$2?[["state","State"]]:[],..."code"===$1?[["custom","Custom groups"]]:[],["none","None"]]'
  ,
    intlKey: 'QkJXbQOXt/'},
  {
    id: 'filter-group-by-label-fallback',
    description: '侧边栏过滤菜单 Group by 回退标签',
    enPattern: /label:"Group by",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),separatorBefore:"none"/g,
    zhSnippet: 'label:"分组依据",options:$1,value:$2,onChange:$3,separatorBefore:"none"',
    zhPattern: /label:"分组依据",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),separatorBefore:"none"/g,
    restoreEn: 'label:"Group by",options:$1,value:$2,onChange:$3,separatorBefore:"none"'
  ,
    intlKey: 'HWWSQ/N0ve'},
  {
    id: 'filter-sort-by-label-fallback',
    description: '侧边栏过滤菜单 Sort by 回退标签',
    enPattern: /label:"Sort by",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+)/g,
    zhSnippet: 'label:"排序方式",options:$1,value:$2,onChange:$3',
    zhPattern: /label:"排序方式",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+)/g,
    restoreEn: 'label:"Sort by",options:$1,value:$2,onChange:$3',
    intlKey: 'hDI+JMUhFd'
  },
  {
    id: 'output-style-labels-mapping',
    description: 'Code 模式输出风格下拉选项 (简洁/详尽/启发/主动)',
    enPattern: /for\(let ([a-zA-Z0-9_$]+) of\[\.\.\.([a-zA-Z0-9_$]+)\?\.builtIns\?\?\[\],\.\.\.\2\?\.customs\?\?\[\]\]\)\{let ([a-zA-Z0-9_$]+)=\1\.toLowerCase\(\);\1\.length===0\|\|([a-zA-Z0-9_$]+)\.has\(\3\)\|\|\(\4\.add\(\3\),([a-zA-Z0-9_$]+)\.push\(\{value:\1,label:\1\}\)\)\}/g,
    zhSnippet: 'for(let $1 of[...$2?.builtIns??[],...$2?.customs??[]]){let $3=$1.toLowerCase();if($1.length!==0&&!$4.has($3)){$4.add($3);let zhLabels={"default":"默认","concise":"简洁","explanatory":"详尽","learning":"启发","proactive":"主动"};let lbl=zhLabels[$3]||$1;$5.push({value:$1,label:lbl})}}',
    zhPattern: /zhLabels=\{"default":"默认","concise":"简洁"/g,
    restoreEn: 'for(let $1 of[...$2?.builtIns??[],...$2?.customs??[]]){let $3=$1.toLowerCase();$1.length===0||$4.has($3)||($4.add($3),$5.push({value:$1,label:$1}))}',
    intlKey: 'outStyleMap'
  },
  {
    id: 'submenu-output-style-label-mapping',
    description: '会话右上角与各级子菜单输出风格项名称汉化',
    enPattern: /children:([a-zA-Z0-9_$]+)\.label\},([a-zA-Z0-9_$]+)\)\)\}\),([a-zA-Z0-9_$]+)&&[a-zA-Z0-9_$]+\([a-zA-Z0-9_$]+,\{children:\[/g,
    zhSnippet: 'children:(function(l){var m={"default":"默认","Concise":"简洁","Explanatory":"详尽","Learning":"启发","Proactive":"主动"};return m[l]||l;})($1.label)},$2))}),$3&&i(r,{children:[',
    zhPattern: /children:\(function\(l\)\{var m=\{"default":"默认"/g,
    restoreEn: 'children:$1.label},$2))}),$3&&i(r,{children:[',
    intlKey: 'subOutStyleMap'
  },
  {
    id: 'session-async-output-style-mapping',
    description: '会话右上角动态异步输出风格项构造函数 (items 列表) 名称汉化',
    enPattern: /items:\[\.\.\.\(([a-zA-Z0-9_$]+)\?\?\[\]\)\.map\(([a-zA-Z0-9_$]+)=>\({\s*label:\2\.label,\s*checked:\2\.checked,\s*onSelect:\2\.onSelect\s*}\)\)/g,
    zhSnippet: 'items:[...($1??[]).map($2=>({label:(function(l){var m={"default":"默认","Concise":"简洁","Explanatory":"详尽","Learning":"启发","Proactive":"主动"};return m[l]||l;})($2.label),checked:$2.checked,onSelect:$2.onSelect}))',
    zhPattern: /var m=\{"default":"默认","Concise":"简洁","Explanatory":"详尽"/g,
    restoreEn: 'items:[...($1??[]).map($2=>({label:$2.label,checked:$2.checked,onSelect:$2.onSelect}))',
    intlKey: 'sessionAsyncOutStyleMap'
  },
  {
    id: 'sidebar-view-all-tooltip',
    description: '侧边栏跳转详情悬浮提示词 (View all ➔ 查看全部)',
    enPattern: /([a-zA-Z0-9_$]+)="View all"/g,
    zhSnippet: '$1="查看全部"',
    zhPattern: /([a-zA-Z0-9_$]+)="查看全部"/g,
    restoreEn: '$1="View all"',
    intlKey: 'sidebarViewAll'
  }
];

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

  // 2. 检查进程占用，若显式要求 autoClose 则安全关闭释放文件锁
  let processAutoClosed = false;
  if (options.autoClose === true && isClaudeRunning()) {
    closeClaude();
    processAutoClosed = true;
  }

  const resDir = info.resourcesPath;
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');
  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');

  // 3. 检查并提权
  if (!canWriteDirectory(resDir)) {
    if (info.installPath) {
      grantPermissions(info.installPath);
    }
    grantPermissions(resDir);
    grantPermissions(path.join(resDir, 'ion-dist'));
    grantPermissions(assetsDir);
    grantPermissions(i18nDir);
    if (!canWriteDirectory(resDir)) {
      return {
        success: false,
        error: '目录写权限不足。请以管理员身份运行（或双击 install.bat）。'
      };
    }
  }

  try {
    // 4. 补丁 JS 资源：注册 zh-CN 语言支持与硬编码下拉项
    let jsPatchedCount = 0;
    const patchHits = {};
    for (const p of JS_LITERAL_PATCHES) {
      patchHits[p.id] = 0;
    }

    const crypto = require('crypto');
    const getHash = (str) => crypto.createHash('sha256').update(str).digest('hex');

    const metaPath = path.join(resDir, '.claude_chinese_meta.json');
    let existingMeta = {};
    if (fs.existsSync(metaPath)) {
      try { existingMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {}; } catch (e) {}
    }
    const fileManifest = existingMeta.files || {};

    if (fs.existsSync(assetsDir)) {
      const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') && !f.endsWith('.orig.bak'));
      const regexAdd = /((?:[\w$]+)=\["en-US"(?:,"[^"]+")+\])/g;

      for (const file of jsFiles) {
        const fullPath = path.join(assetsDir, file);
        const bakPath = `${fullPath}.orig.bak`;
        const content = fs.existsSync(bakPath) ? fs.readFileSync(bakPath, 'utf8') : fs.readFileSync(fullPath, 'utf8');
        const currentHash = getHash(content);

        let newContent = content;
        let modified = false;

        if (newContent.includes('"en-US"') && !newContent.includes('"zh-CN"')) {
          if (regexAdd.test(newContent)) {
            newContent = newContent.replace(regexAdd, (match) => {
              return match.slice(0, -1) + ',"zh-CN"]';
            });
            modified = true;
          }
        }

        // 结构化硬编码补丁注入与命中统计
        for (const patch of JS_LITERAL_PATCHES) {
          if (patch.enPattern.test(newContent)) {
            newContent = newContent.replace(patch.enPattern, patch.zhSnippet);
            patchHits[patch.id]++;
            modified = true;
          } else if (patch.zhPattern.test(newContent)) {
            patchHits[patch.id]++;
          }
        }

        // 动态注入“了解更多”长篇折叠文档全局翻译拦截器
        const longDocsPath = path.join(__dirname, '../dict/long-docs-zh-CN.json');
        if (fs.existsSync(longDocsPath) && newContent.includes('function z(e,t){return{text:e,...t}}')) {
          const longDocs = JSON.parse(fs.readFileSync(longDocsPath, 'utf8'));
          const zRepl = `var __ZH_DOCS__=${JSON.stringify(longDocs)};function z(e,t){var tr=__ZH_DOCS__[e];if(!tr&&typeof e==="string"){for(var k in __ZH_DOCS__){if(e.indexOf(k)===0||(k.length>20&&e.indexOf(k)!==-1)){tr=__ZH_DOCS__[k];break;}}}return{text:tr||e,...t}}`;
          newContent = newContent.replace('function z(e,t){return{text:e,...t}}', zRepl);
          modified = true;
        }

        if (modified && newContent !== content) {
          if (!fs.existsSync(bakPath)) {
            fs.copyFileSync(fullPath, bakPath);
          }
          fileManifest[file] = {
            originalHash: currentHash,
            patchedHash: getHash(newContent)
          };

          fs.writeFileSync(fullPath, newContent, 'utf8');
          jsPatchedCount++;
        }
      }
    }

    const warnings = [];
    if (fs.existsSync(assetsDir)) {
      for (const patch of JS_LITERAL_PATCHES) {
        if (patchHits[patch.id] === 0 && !patch.intlKey) {
          warnings.push(`[硬编码补丁未命中] ${patch.id} (${patch.description}): 上游代码结构可能已发生变更`);
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

    // 6. 写入元数据与文件哈希清单
    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
    const meta = {
      patchedAt: new Date().toISOString(),
      version: info.version,
      type: info.type,
      jsPatchedCount,
      totalEntries: Object.keys(ionZh).length,
      mode: 'incremental_overlay',
      files: fileManifest
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
        processAutoClosed,
        warnings,
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
    // 1. 增量挂载纯净清理：仅移除注入的中文文件与元数据，绝对不触碰官方原版 en-US.json
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

    // 3. 权威物理出厂恢复：从 .orig.bak 还原官方被修改 JS 资源
    if (fs.existsSync(assetsDir)) {
      const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') && !f.endsWith('.orig.bak'));
      for (const file of jsFiles) {
        const fullPath = path.join(assetsDir, file);
        const bakPath = `${fullPath}.orig.bak`;

        if (fs.existsSync(bakPath)) {
          // 物理级 100% 纯净出厂覆盖还原
          fs.copyFileSync(bakPath, fullPath);
          fs.unlinkSync(bakPath);
        } else {
          // 兜底：正则清理
          let content = fs.readFileSync(fullPath, 'utf8');
          let modified = false;
          if (content.includes(',"zh-CN"]')) {
            content = content.replace(',"zh-CN"]', ']');
            modified = true;
          }
          for (const patch of JS_LITERAL_PATCHES) {
            if (patch.zhPattern.test(content)) {
              content = content.replace(patch.zhPattern, patch.restoreEn);
              modified = true;
            }
          }
          if (modified) {
            fs.writeFileSync(fullPath, content, 'utf8');
          }
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
  restorePatch,
  isClaudeRunning,
  closeClaude,
  JS_LITERAL_PATCHES
};
