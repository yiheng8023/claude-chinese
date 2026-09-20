/**
 * 核心全量注入器与还原引擎 (支持增量挂载兜底、官方原版 en-US 零侵入保护、官方中文自动检测与优雅让位)
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('./msix-detector');
const { canWriteDirectory, grantPermissions } = require('./permissions');
const { execSync } = require('child_process');
const crypto = require('crypto');

const getHash = (str) => crypto.createHash('sha256').update(str).digest('hex');

/**
 * 消除带 /g 标志的 RegExp 在 .test() 时 lastIndex 状态遗留污染的统一守卫
 */
function safeTest(pattern, text) {
  if (!pattern || typeof text !== 'string') return false;
  if (pattern.global) {
    pattern.lastIndex = 0;
  }
  const result = pattern.test(text);
  if (pattern.global) {
    pattern.lastIndex = 0;
  }
  return result;
}

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

function isProtectedEnvironment() {
  return Boolean(
    process.env.CLAUDE_CODE ||
    process.env.ANTHROPIC_AGENT ||
    process.env.CLAUDE_AGENT ||
    process.env.CLAUDE_NO_KILL === '1' ||
    process.env.AGENT_ENVIRONMENT ||
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.NODE_ENV === 'test'
  );
}

function closeClaude() {
  if (isProtectedEnvironment()) {
    console.log('🛡️ [安全保护拦截] 检测到当前运行于智能体会话或受保护环境中，已严正拦截强杀宿主进程，防止会话与客户端崩溃！');
    return false;
  }
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
    intlKey: 'xmcVZ0BU63'},
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
    intlKey: 'NgcLgMejq0'
  },
  {
    id: 'filter-clear-filters',
    description: '侧边栏过滤菜单清除过滤器按钮',
    enPattern: /children:"Clear filters"/g,
    zhSnippet: 'children:"清除过滤器"',
    zhPattern: /children:"清除过滤器"/g,
    restoreEn: 'children:"Clear filters"',
    intlKey: 'F4gyn3vRX6'
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
  },
  {
    id: 'activity-token-books-mapping',
    description: '活动热力图阅读量对比世界名著书名汉化 (Moby-Dick 等)',
    enPattern: /name:"The Little Prince",tokens:22e3\},\{name:"Animal Farm",tokens:39e3\},\{name:"The Great Gatsby",tokens:62e3\},\{name:"Harry Potter and the Philosopher's Stone",tokens:103e3\},\{name:"The Hobbit",tokens:123e3\},\{name:"Pride and Prejudice",tokens:156e3\},\{name:"Dune",tokens:244e3\},\{name:"Moby-Dick",tokens:268e3\},\{name:"The Lord of the Rings",tokens:576e3\},\{name:"War and Peace",tokens:73e4\}/g,
    zhSnippet: 'name:"小王子",tokens:22e3},{name:"动物庄园",tokens:39e3},{name:"了不起的盖茨比",tokens:62e3},{name:"哈利·波特与魔法石",tokens:103e3},{name:"霍比特人",tokens:123e3},{name:"傲慢与偏见",tokens:156e3},{name:"沙丘",tokens:244e3},{name:"白鲸",tokens:268e3},{name:"魔戒",tokens:576e3},{name:"战争与和平",tokens:73e4}',
    zhPattern: /name:"白鲸",tokens:268e3/g,
    restoreEn: 'name:"The Little Prince",tokens:22e3},{name:"Animal Farm",tokens:39e3},{name:"The Great Gatsby",tokens:62e3},{name:"Harry Potter and the Philosopher\'s Stone",tokens:103e3},{name:"The Hobbit",tokens:123e3},{name:"Pride and Prejudice",tokens:156e3},{name:"Dune",tokens:244e3},{name:"Moby-Dick",tokens:268e3},{name:"The Lord of the Rings",tokens:576e3},{name:"War and Peace",tokens:73e4}',
    intlKey: 'activityBooks'
  },
  {
    id: 'thinking-effort-options-mapping',
    description: '第三方推理配置默认思考强度下拉选项 (low/medium/high/xhigh/max ➔ 低/中/高/极高/最大)',
    enPattern: /return\{value:([a-zA-Z0-9_$]+),label:([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\.meta\.optionLabels\?\.\[\1\]\)\?\?\1,disabled:/g,
    zhSnippet: 'var _em={"low":"低","medium":"中","high":"高","xhigh":"极高","max":"最大"};return{value:$1,label:$2($3,$4.meta.optionLabels?.[$1])??_em[$1]??$1,disabled:',
    zhPattern: /var _em=\{"low":"低","medium":"中","high":"高","xhigh":"极高","max":"最大"\};return\{value:([a-zA-Z0-9_$]+),label:([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\.meta\.optionLabels\?\.\[\1\]\)\?\?_em\[\1\]\?\?\1,disabled:/g,
    restoreEn: 'return{value:$1,label:$2($3,$4.meta.optionLabels?.[$1])??$1,disabled:',
    intlKey: 'effortOptionsMap'
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
        error: '目录写权限不足。请右键点击 install.bat 选择【以管理员身份运行】。'
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
        const current = fs.readFileSync(fullPath, 'utf8');
        const currentHash = getHash(current);

        let content = current;

        if (fs.existsSync(bakPath)) {
          const bak = fs.readFileSync(bakPath, 'utf8');
          const bakHash = getHash(bak);

          // 核心防御：判断当前 fullPath 是否处于已被我们打过补丁的状态
          const isOurPatched = (fileManifest[file] && currentHash === fileManifest[file].patchedHash) ||
                               current.includes(',"zh-CN"]') ||
                               current.includes('var __ZH_DOCS__=') ||
                               JS_LITERAL_PATCHES.some(p => safeTest(p.zhPattern, current));

          if (currentHash !== bakHash && !isOurPatched) {
            // 官方已静默更新该文件（内容变动且不含我们的汉化特征）
            // 必须立即刷新备份基线为官方最新原版，丢弃陈旧备份，杜绝跨版本降级！
            fs.copyFileSync(fullPath, bakPath);
            content = current;
          } else {
            // 同版本正常重入（走纯净备份基线，实现幂等热重载）
            content = bak;
          }
        }

        const baselineHash = getHash(content);

        let newContent = content;
        let modified = false;

        if (newContent.includes('"en-US"') && !newContent.includes('"zh-CN"')) {
          if (safeTest(regexAdd, newContent)) {
            newContent = newContent.replace(regexAdd, (match) => {
              return match.slice(0, -1) + ',"zh-CN"]';
            });
            modified = true;
          }
        }

        // 结构化硬编码补丁注入与命中统计
        for (const patch of JS_LITERAL_PATCHES) {
          if (safeTest(patch.enPattern, newContent)) {
            newContent = newContent.replace(patch.enPattern, patch.zhSnippet);
            patchHits[patch.id]++;
            modified = true;
          } else if (safeTest(patch.zhPattern, newContent)) {
            patchHits[patch.id]++;
          }
        }

        // 动态注入“了解更多”长篇折叠文档全局翻译拦截器 (多签名自适应拓扑引擎，适配变量混淆名变异与函数语法变异)
        const longDocsPath = path.join(__dirname, '../dict/long-docs-zh-CN.json');
        const zFnDeclarationRegex = /function\s+([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)\{return\{text:\2,\.\.\.\3\}\}/g;
        const zFnArrowRegex = /([a-zA-Z0-9_$]+)=\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)=>\(\{text:\2,\.\.\.\3\}\)/g;
        const zFnAssignRegex = /function\s+([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)\{return\s+Object\.assign\(\{text:\2\},\3\)\}/g;

        if (fs.existsSync(longDocsPath) && (safeTest(zFnDeclarationRegex, newContent) || safeTest(zFnArrowRegex, newContent) || safeTest(zFnAssignRegex, newContent))) {
          const longDocs = JSON.parse(fs.readFileSync(longDocsPath, 'utf8'));
          let hasInjectedHeader = newContent.includes('var __ZH_DOCS__=');
          let header = hasInjectedHeader ? '' : `var __ZH_DOCS__=${JSON.stringify(longDocs)},__ZH_CACHE__={};`;

          // 1. 标准函数声明式拓扑
          newContent = newContent.replace(zFnDeclarationRegex, (match, fnName, a1, a2) => {
            const repl = `${header}function ${fnName}(${a1},${a2}){if(typeof ${a1}!=="string")return{text:${a1},...${a2}};var tr=__ZH_CACHE__[${a1}];if(tr===undefined){tr=__ZH_DOCS__[${a1}];if(!tr&&${a1}.length>10){for(var k in __ZH_DOCS__){if(${a1}.indexOf(k)===0||(k.length>20&&${a1}.indexOf(k)!==-1)){tr=__ZH_DOCS__[k];break;}}}__ZH_CACHE__[${a1}]=tr||null;}return{text:tr||${a1},...${a2}}}`;
            header = '';
            return repl;
          });

          // 2. 箭头函数变异式拓扑
          newContent = newContent.replace(zFnArrowRegex, (match, fnName, a1, a2) => {
            const repl = `${header}${fnName}=(${a1},${a2})=>{if(typeof ${a1}!=="string")return{text:${a1},...${a2}};var tr=__ZH_CACHE__[${a1}];if(tr===undefined){tr=__ZH_DOCS__[${a1}];if(!tr&&${a1}.length>10){for(var k in __ZH_DOCS__){if(${a1}.indexOf(k)===0||(k.length>20&&${a1}.indexOf(k)!==-1)){tr=__ZH_DOCS__[k];break;}}}__ZH_CACHE__[${a1}]=tr||null;}return{text:tr||${a1},...${a2}}}`;
            header = '';
            return repl;
          });

          // 3. Object.assign 变异式拓扑
          newContent = newContent.replace(zFnAssignRegex, (match, fnName, a1, a2) => {
            const repl = `${header}function ${fnName}(${a1},${a2}){if(typeof ${a1}!=="string")return Object.assign({text:${a1}},${a2});var tr=__ZH_CACHE__[${a1}];if(tr===undefined){tr=__ZH_DOCS__[${a1}];if(!tr&&${a1}.length>10){for(var k in __ZH_DOCS__){if(${a1}.indexOf(k)===0||(k.length>20&&${a1}.indexOf(k)!==-1)){tr=__ZH_DOCS__[k];break;}}}__ZH_CACHE__[${a1}]=tr||null;}return Object.assign({text:tr||${a1}},${a2})}`;
            header = '';
            return repl;
          });

          modified = true;
        }

        if (modified && newContent !== content) {
          if (!fs.existsSync(bakPath)) {
            fs.copyFileSync(fullPath, bakPath);
          }
          fileManifest[file] = {
            originalHash: baselineHash,
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

    // 辅助函数：检测 en-US 是否为纯净官方未污染版本
    const isEnUsClean = (content) => {
      if (!content) return false;
      return !content.includes('实际大小') && !content.includes('新对话') && !content.includes('团队 (Team)');
    };

    // 辅助函数：基于官方当前 en-US.json 进行增量合并，生成目标 zh-CN.json
    const createIncrementalZh = (targetDir, zhDict) => {
      const enPath = path.join(targetDir, 'en-US.json');
      const bakPath = path.join(targetDir, 'en-US.backup.json');
      let baseEn = {};

      // 确立当前未污染的官方 en-US.json 为绝对第一权威基线 (消除陈旧备份覆盖风险)
      if (fs.existsSync(enPath)) {
        try {
          const content = fs.readFileSync(enPath, 'utf8');
          if (isEnUsClean(content)) {
            baseEn = JSON.parse(content);
          }
        } catch (e) {}
      }

      // 仅当当前 en-US 缺失或被历史中文污染时，才回退从纯净备份读取基底
      if (Object.keys(baseEn).length === 0 && fs.existsSync(bakPath)) {
        try {
          const bakContent = fs.readFileSync(bakPath, 'utf8');
          if (isEnUsClean(bakContent)) {
            baseEn = JSON.parse(bakContent);
          }
        } catch (e) {}
      }

      // 增量合并：官方未翻译词条保留英文作为兜底，已翻译词条精准替换，生产级紧凑单行格式极速减重
      const merged = Object.assign({}, baseEn, zhDict);
      fs.writeFileSync(path.join(targetDir, 'zh-CN.json'), JSON.stringify(merged), 'utf8');
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

    // 5. 官方 en-US 权威保护与防旧备份覆盖降级熔断
    const sanitizeEnUS = (targetDir, fallbackBase) => {
      const enPath = path.join(targetDir, 'en-US.json');
      const bakPath = path.join(targetDir, 'en-US.backup.json');

      if (!fs.existsSync(enPath)) {
        if (fs.existsSync(bakPath)) {
          fs.copyFileSync(bakPath, enPath);
        } else if (fallbackBase && fs.existsSync(fallbackBase)) {
          fs.copyFileSync(fallbackBase, enPath);
        }
        return;
      }

      const content = fs.readFileSync(enPath, 'utf8');
      const isPolluted = !isEnUsClean(content);

      if (isPolluted) {
        // 当前 en-US 确实被污染，尝试从纯净旧备份或 fallbackBase 恢复
        if (fs.existsSync(bakPath)) {
          const bakContent = fs.readFileSync(bakPath, 'utf8');
          if (isEnUsClean(bakContent)) {
            fs.copyFileSync(bakPath, enPath);
            return;
          }
        }
        if (fallbackBase && fs.existsSync(fallbackBase)) {
          fs.copyFileSync(fallbackBase, enPath);
        }
      } else {
        // 核心安全原则：当前 en-US 100% 为官方未污染纯净版，确立其绝对权威！
        // 绝不允许旧备份覆盖当前新版；若存在陈旧备份，安全清理以消除潜在降级风险！
        if (fs.existsSync(bakPath)) {
          try { fs.unlinkSync(bakPath); } catch (e) {}
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
    // 0. 优先读取现有元数据清单，用于判定文件是否确为补丁版本
    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
    let existingMeta = {};
    if (fs.existsSync(metaFile)) {
      try { existingMeta = JSON.parse(fs.readFileSync(metaFile, 'utf8')) || {}; } catch (e) {}
    }
    const fileManifest = existingMeta.files || {};

    // 1. 增量挂载纯净清理：仅移除注入的中文文件与元数据，绝对不触碰官方原版 en-US.json
    const filesToDelete = [
      path.join(resDir, 'zh-CN.json'),
      path.join(i18nDir, 'zh-CN.json'),
      path.join(i18nDir, 'zh-CN.overrides.json'),
      path.join(dynDir, 'zh-CN.json'),
      metaFile
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
          const current = fs.readFileSync(fullPath, 'utf8');
          const currentHash = getHash(current);

          const isOurPatched = (fileManifest[file] && currentHash === fileManifest[file].patchedHash) ||
                               current.includes(',"zh-CN"]') ||
                               current.includes('var __ZH_DOCS__=') ||
                               JS_LITERAL_PATCHES.some(p => safeTest(p.zhPattern, current));

          // 核心防御：仅当当前文件确为补丁文件时才还原；若官方已静默更新，严禁将旧 bak 覆盖新版！
          if (isOurPatched) {
            fs.copyFileSync(bakPath, fullPath);
          }
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
            if (safeTest(patch.zhPattern, content)) {
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
  isProtectedEnvironment,
  JS_LITERAL_PATCHES,
  safeTest
};
