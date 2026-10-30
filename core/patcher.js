/**
 * 核心全量注入器与还原引擎 (支持增量挂载兜底、官方原版 en-US 零侵入保护、官方中文自动检测与优雅让位)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getClaudeInstallation } = require('./msix-detector');
const { canWriteDirectory, grantPermissions, sanitizePermissions } = require('./permissions');
const { execSync, execFileSync } = require('child_process');
const crypto = require('crypto');
const asar = require('@electron/asar');
const { patchShellLocale } = require('./shell-locale');
const { applyAsarTransaction, restoreAsarTransaction } = require('./asar-transaction');
const { localizationFingerprint } = require('./localization-state');
const { validatePair, validateSyntax } = require('../tools/icu-validator');

const getHash = (str) => crypto.createHash('sha256').update(str).digest('hex');

/**
 * 借助 Node.js 子进程同步执行 ASAR 打包，规避复杂异步改动并免疫路径空格
 */
function packAsarSync(srcDir, destFile, options = {}) {
  const unpackPattern = options.unpack ? options.unpack : '';
  const code = unpackPattern
    ? 'const asar = require("@electron/asar"); (async () => { try { await asar.createPackageWithOptions(process.argv[1], process.argv[2], { unpack: process.argv[3] }); } catch (err) { console.error(err); process.exit(1); } })();'
    : 'const asar = require("@electron/asar"); (async () => { try { await asar.createPackage(process.argv[1], process.argv[2]); } catch (err) { console.error(err); process.exit(1); } })();';
  const args = unpackPattern
    ? ['-e', code, srcDir, destFile, unpackPattern]
    : ['-e', code, srcDir, destFile];
  execFileSync(process.execPath, args, { stdio: 'pipe' });
  if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
}

/**
 * 读取 ASAR 文件 Raw Header 并计算 SHA256 哈希值
 */
function getRawHeaderSha256(archivePath) {
  if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
  const rawHeader = asar.getRawHeader(archivePath);
  return crypto.createHash('sha256').update(rawHeader.headerString).digest('hex');
}

/**
 * 对 claude.exe 执行安全原位同步 (保持 Electron Fuse 4 完整性防线激活 + PE 资源 Header SHA256 原位替换)
 */
function patchClaudeExe(exePath, asarHashes = {}) {
  if (!fs.existsSync(exePath)) {
    return { success: false, modified: false, error: `未找到主程序: ${exePath}` };
  }
  // 兼容直接传入单个字符串 (newAsarSha256) 的向后兼容调用
  const hashMap = typeof asarHashes === 'string' ? { 'ion-dist.asar': asarHashes } : asarHashes;

  const exeBuf = fs.readFileSync(exePath);
  let modified = false;
  const matched = [];

  // 1. 原位替换 PE 资源中硬编码的各 ASAR Header SHA256 (64 字符十六进制)
  for (const [asarName, newSha256] of Object.entries(hashMap)) {
    if (!/^[a-fA-F0-9]{64}$/.test(newSha256)) {
      return { success: false, modified: false, error: `无效的 ASAR SHA256: ${asarName}` };
    }
    let found = false;
    const patterns = [
      Buffer.from(`resources\\\\${asarName}","alg":"SHA256","value":"`),
      Buffer.from(`resources/${asarName}","alg":"SHA256","value":"`),
      Buffer.from(`${asarName}","alg":"SHA256","value":"`)
    ];

    for (const pattern of patterns) {
      const pIdx = exeBuf.indexOf(pattern);
      if (pIdx !== -1) {
        const hashStart = pIdx + pattern.length;
        const currentHash = exeBuf.subarray(hashStart, hashStart + 64).toString('utf8');
        if (!/^[a-fA-F0-9]{64}$/.test(currentHash) || exeBuf[hashStart + 64] !== 0x22) continue;
        if (currentHash !== newSha256) {
          Buffer.from(newSha256, 'utf8').copy(exeBuf, hashStart);
          modified = true;
        }
        found = true;
        break;
      }
    }
    if (!found) return { success: false, modified: false, error: `无法定位 ${asarName} 的完整性哈希；主程序未修改。` };
    matched.push(asarName);
  }

  // 2. 核心安全防护：确保 Electron Fuse 4 (embeddedAsarIntegrityValidation) 保持激活状态 ('1' = 0x31)
  // 杜绝因关闭完整性校验导致本地任意 ASAR 篡改提权风险
  const fuseMagic = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
  const fuseIdx = exeBuf.indexOf(fuseMagic);
  if (fuseIdx < 0 || exeBuf[fuseIdx + 32] !== 1 || exeBuf[fuseIdx + 33] < 5) {
    return { success: false, modified: false, error: '无法确认 Electron 熔丝结构；主程序未修改。' };
  }
  let integrityEnforced = null;
  if (fuseIdx !== -1) {
    const fuse4Pos = fuseIdx + 38;
    integrityEnforced = (exeBuf[fuse4Pos] === 0x31);
    if (!integrityEnforced) return { success: false, modified: false, error: '原程序 ASAR 完整性熔丝未开启；请恢复官方原版后重试。' };
  }

  if (modified) {
    fs.writeFileSync(exePath, exeBuf);
  }

  if (!matched.length) {
    return {
      success: false,
      modified: false,
      error: '无法在 claude.exe 中定位 PE 资源中的 ASAR SHA256 哈希值，上游二进制结构可能已发生变动！'
    };
  }

  return { success: true, modified, integrityEnforced, error: null };
}

/**
 * ESM AST 语法完整性快速自检 (保证注入后的 JS 文件语法绝对合法，杜绝客户端黑屏崩溃)
 */
function validateJsSyntax(code) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-syntax-check-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));
    const testFile = path.join(tmp, 'check.js');
    fs.writeFileSync(testFile, code);
    execFileSync(process.execPath, ['--check', testFile], { stdio: 'pipe' });
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.stderr ? err.stderr.toString().trim() : err.message };
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
}

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
    enGuard: 'worktrees',
    zhGuard: 'worktrees',
    enPattern: /label:\s*["']Inside project \(\.claude\/worktrees\)["']/g,
    zhSnippet: 'label:"项目目录内 (.claude/worktrees)"',
    zhPattern: /label:\s*["']项目目录内 \(\.claude\/worktrees\)["']/g,
    restoreEn: 'label:"Inside project (.claude/worktrees)"',
    intlKey: 'eI3zYFFnpz'
  },
  {
    id: 'worktrees-location-custom',
    description: 'Claude Code 工作树自定义位置下拉选项',
    enGuard: 'Custom...',
    zhGuard: '自定义...',
    enPattern: /label:\s*["']Custom\.\.\.["']/g,
    zhSnippet: 'label:"自定义..."',
    zhPattern: /label:\s*["']自定义\.\.\.["']/g,
    restoreEn: 'label:"Custom..."',
    intlKey: 'lKjjJ7PIFW'
  },
  {
    id: 'sidebar-toggle-tooltip',
    description: '侧边栏收起/展开按钮提示词',
    enGuard: 'Expand sidebar',
    zhGuard: '收起侧边栏',
    enPattern: /content:([a-zA-Z0-9_$]+)\?"Expand sidebar":"Collapse sidebar"/g,
    zhSnippet: 'content:$1?"展开侧边栏":"收起侧边栏"',
    zhPattern: /content:([a-zA-Z0-9_$]+)\?"展开侧边栏":"收起侧边栏"/g,
    restoreEn: 'content:$1?"Expand sidebar":"Collapse sidebar"',
    intlKey: 'WB0Ad2QFAl'
  },
  {
    id: 'sidebar-toggle-aria',
    description: '侧边栏收起/展开无障碍标签',
    enGuard: 'Expand sidebar',
    zhGuard: '收起侧边栏',
    enPattern: /"aria-label":([a-zA-Z0-9_$]+)\?"Expand sidebar":"Collapse sidebar"/g,
    zhSnippet: '"aria-label":$1?"展开侧边栏":"收起侧边栏"',
    zhPattern: /"aria-label":([a-zA-Z0-9_$]+)\?"展开侧边栏":"收起侧边栏"/g,
    restoreEn: '"aria-label":$1?"Expand sidebar":"Collapse sidebar"',
    intlKey: '+G35mRWa75'
  },
  {
    id: 'sidebar-search-tooltip',
    description: '侧边栏搜索按钮提示词',
    enGuard: 'content:"Search"',
    zhGuard: 'content:"搜索"',
    enPattern: /content:"Search",shortcut:([a-zA-Z0-9_$]+),side:"bottom"/g,
    zhSnippet: 'content:"搜索",shortcut:$1,side:"bottom"',
    zhPattern: /content:"搜索",shortcut:([a-zA-Z0-9_$]+),side:"bottom"/g,
    restoreEn: 'content:"Search",shortcut:$1,side:"bottom"',
    intlKey: 'xmcVZ0BU63'
  },
  {
    id: 'filter-status-label',
    description: 'Code 模式侧边栏过滤菜单 Status 标签',
    enGuard: 'label:"Status"',
    zhGuard: 'label:"状态"',
    enPattern: /label:"Status",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),active:"active"!==/g,
    zhSnippet: 'label:"状态",options:$1,value:$2,onChange:$3,active:"active"!==',
    zhPattern: /label:"状态",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),active:"active"!==/g,
    restoreEn: 'label:"Status",options:$1,value:$2,onChange:$3,active:"active"!==',
    intlKey: 'tzMNF3jWoU'
  },
  {
    id: 'filter-last-activity-label',
    description: 'Code 模式侧边栏过滤菜单 Last activity 标签',
    enGuard: 'label:"Last activity"',
    zhGuard: 'label:"最近活动"',
    enPattern: /label:"Last activity",options:([a-zA-Z0-9_$]+),value:String\(([a-zA-Z0-9_$]+)\)/g,
    zhSnippet: 'label:"最近活动",options:$1,value:String($2)',
    zhPattern: /label:"最近活动",options:([a-zA-Z0-9_$]+),value:String\(([a-zA-Z0-9_$]+)\)/g,
    restoreEn: 'label:"Last activity",options:$1,value:String($2)',
    intlKey: 'pEcdNTP2U6'
  },
  {
    id: 'filter-show-empty-folders',
    description: '侧边栏过滤菜单显示空文件夹选项',
    enGuard: 'Show empty folders',
    zhGuard: '显示空文件夹',
    enPattern: /children:"Show empty folders"/g,
    zhSnippet: 'children:"显示空文件夹"',
    zhPattern: /children:"显示空文件夹"/g,
    restoreEn: 'children:"Show empty folders"',
    intlKey: 'JCuww4OJ/t'
  },
  {
    id: 'filter-clear-filters',
    description: '侧边栏过滤菜单清除过滤器按钮',
    enGuard: 'Clear filters',
    zhGuard: '清除过滤器',
    enPattern: /children:"Clear filters"/g,
    zhSnippet: 'children:"清除过滤器"',
    zhPattern: /children:"清除过滤器"/g,
    restoreEn: 'children:"Clear filters"',
    intlKey: 'F4gyn3vRX6'
  },
  {
    id: 'filter-options-yM',
    description: '侧边栏过滤状态选项 (活跃/已归档/全部)',
    enGuard: '"Active"',
    zhGuard: '"活跃"',
    enPattern: /\[\["active","Active"\],\["archived","Archived"\],\["all","All"\]\]/g,
    zhSnippet: '[["active","活跃"],["archived","已归档"],["all","全部"]]',
    zhPattern: /\[\["active","活跃"\],\["archived","已归档"\],\["all","全部"\]\]/g,
    restoreEn: '[["active","Active"],["archived","Archived"],["all","All"]]',
    intlKey: 'zQvVDJ+j59'
  },
  {
    id: 'filter-options-wM',
    description: '侧边栏排序选项 (按字母/创建时间/最近)',
    enGuard: '"Alphabetically"',
    zhGuard: '"按字母顺序"',
    enPattern: /\[\["alpha","Alphabetically"\],\["created","Created time"\],\["recency","Recency"\]\]/g,
    zhSnippet: '[["alpha","按字母顺序"],["created","创建时间"],["recency","最近"]]',
    zhPattern: /\[\["alpha","按字母顺序"\],\["created","创建时间"\],\["recency","最近"\]\]/g,
    restoreEn: '[["alpha","Alphabetically"],["created","Created time"],["recency","Recency"]]',
    intlKey: 'bF46uAWl+6'
  },
  {
    id: 'filter-options-group-by-code',
    description: 'Code 模式侧边栏分组选项 (日期/文件夹/状态/自定义/无)',
    enGuard: 'group-by-code',
    zhGuard: 'group-by-code',
    enPattern: /return\[\["date","Date"\],\.\.\."code"===([a-zA-Z0-9_$]+)\?\[\["project","Folder"\]\]:\[\],\.\.\."code"===\1&&([a-zA-Z0-9_$]+)\?\[\["state","State"\]\]:\[\],\.\.\."code"===\1\?\[\["custom","Custom groups"\]\]:\[\],\["none","None"\]\]/g,
    zhSnippet: 'return[["date","日期"],..."code"===$1?[["project","文件夹"]]:[],..."code"===$1&&$2?[["state","状态"]]:[],..."code"===$1?[["custom","自定义分组"]]:[],["none","无"]]',
    zhPattern: /return\[\["date","日期"\],\.\.\."code"===([a-zA-Z0-9_$]+)\?\[\["project","文件夹"\]\]:\[\],\.\.\."code"===\1&&([a-zA-Z0-9_$]+)\?\[\["state","状态"\]\]:\[\],\.\.\."code"===\1\?\[\["custom","自定义分组"\]\]:\[\],\["none","无"\]\]/g,
    restoreEn: 'return[["date","Date"],..."code"===$1?[["project","Folder"]]:[],..."code"===$1&&$2?[["state","State"]]:[],..."code"===$1?[["custom","Custom groups"]]:[],["none","None"]]',
    intlKey: 'yqhs/ALTJm'
  },
  {
    id: 'filter-group-by-label-fallback',
    description: '侧边栏过滤菜单 Group by 回退标签',
    enGuard: 'label:"Group by"',
    zhGuard: 'label:"分组依据"',
    enPattern: /label:"Group by",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),separatorBefore:"none"/g,
    zhSnippet: 'label:"分组依据",options:$1,value:$2,onChange:$3,separatorBefore:"none"',
    zhPattern: /label:"分组依据",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+),separatorBefore:"none"/g,
    restoreEn: 'label:"Group by",options:$1,value:$2,onChange:$3,separatorBefore:"none"',
    intlKey: 'MHeS4mgvyP'
  },
  {
    id: 'filter-sort-by-label-fallback',
    description: '侧边栏过滤菜单 Sort by 回退标签',
    enGuard: 'label:"Sort by"',
    zhGuard: 'label:"排序方式"',
    enPattern: /label:"Sort by",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+)/g,
    zhSnippet: 'label:"排序方式",options:$1,value:$2,onChange:$3',
    zhPattern: /label:"排序方式",options:([a-zA-Z0-9_$]+),value:([a-zA-Z0-9_$]+),onChange:([a-zA-Z0-9_$]+)/g,
    restoreEn: 'label:"Sort by",options:$1,value:$2,onChange:$3',
    intlKey: '4WosAJhkMe'
  },
  {
    id: 'output-style-labels-mapping',
    description: 'Code 模式输出风格下拉选项 (简洁/详尽/启发/主动)',
    enGuard: 'builtIns',
    zhGuard: 'zhLabels=',
    enPattern: /for\(let ([a-zA-Z0-9_$]+) of\[\.\.\.([a-zA-Z0-9_$]+)(?:\?\.builtIns\?\?\[\])?,\.\.\.([a-zA-Z0-9_$]+)(?:\?\.customs\?\?\[\])?\]\)\{let ([a-zA-Z0-9_$]+)=\1\.toLowerCase\(\);\1\.length===0\|\|([a-zA-Z0-9_$]+)\.has\(\4\)\|\|\(\5\.add\(\4\),([a-zA-Z0-9_$]+)\.push\(\{value:\1,label:\1\}\)\)\}/g,
    zhSnippet: 'for(let $1 of[...$2,...$3]){let $4=$1.toLowerCase();if($1.length!==0&&!$5.has($4)){$5.add($4);let zhLabels={"default":"默认","concise":"简洁","explanatory":"详尽","learning":"启发","proactive":"主动"};let lbl=zhLabels[$4]||$1;$6.push({value:$1,label:lbl})}}',
    zhPattern: /zhLabels=\{"default":"默认","concise":"简洁"/g,
    restoreEn: 'for(let $1 of[...$2,...$3]){let $4=$1.toLowerCase();$1.length===0||$5.has($4)||($5.add($4),$6.push({value:$1,label:$1}))}',
    intlKey: 'outStyleMap'
  },
  {
    id: 'submenu-output-style-label-mapping',
    description: '会话右上角与各级子菜单输出风格项名称汉化',
    enGuard: 'checkedRole:"radio"',
    zhGuard: 'checkedRole:"radio"',
    enPattern: /([a-zA-Z0-9_$]+)\.map\(\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)=>([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+)\.Item,\{checked:\2\.checked,checkedRole:"radio",onClick:\(\)=>\{([a-zA-Z0-9_$]+)\(\),\2\.onSelect\(\)\},children:\2\.label\},\3\)\)/g,
    zhSnippet: '$1.map(($2,$3)=>$4($5.Item,{checked:$2.checked,checkedRole:"radio",onClick:()=>{$6(),$2.onSelect()},children:(function(l){var m={"default":"默认","Concise":"简洁","Explanatory":"详尽","Learning":"启发","Proactive":"主动"};return m[l]||l;})($2.label)},$3))',
    zhPattern: /([a-zA-Z0-9_$]+)\.map\(\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)=>([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+)\.Item,\{checked:\2\.checked,checkedRole:"radio",onClick:\(\)=>\{([a-zA-Z0-9_$]+)\(\),\2\.onSelect\(\)\},children:\(function\(l\)\{var m=\{"default":"默认","Concise":"简洁","Explanatory":"详尽","Learning":"启发","Proactive":"主动"\};return m\[l\]\|\|l;\}\)\(\2\.label\)\},\3\)\)/g,
    restoreEn: '$1.map(($2,$3)=>$4($5.Item,{checked:$2.checked,checkedRole:"radio",onClick:()=>{$6(),$2.onSelect()},children:$2.label},$3))',
    intlKey: 'subOutStyleMap'
  },
  {
    id: 'session-async-output-style-mapping',
    description: '会话右上角动态异步输出风格项构造函数 (items 列表) 名称汉化',
    enGuard: '7Aqe2/LqFL',
    zhGuard: '7Aqe2/LqFL',
    enPattern: /function ([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)\{if\(\2!=="default"\)return \2;let ([a-zA-Z0-9_$]+)=\3\.formatMessage\(\{defaultMessage:"Default",id:"7Aqe2\/LqFL"\}\);/g,
    zhSnippet: 'function $1($2,$3,$4){var _osm={"Concise":"简洁","Explanatory":"详尽","Learning":"启发","Proactive":"主动"};if($2!=="default")return _osm[$2]||$2;let $5=$3.formatMessage({defaultMessage:"Default",id:"7Aqe2/LqFL"});',
    zhPattern: /function ([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)\{var _osm=\{"Concise":"简洁","Explanatory":"详尽","Learning":"启发","Proactive":"主动"\};if\(\2!=="default"\)return _osm\[\2\]\|\|\2;let ([a-zA-Z0-9_$]+)=\3\.formatMessage\(\{defaultMessage:"Default",id:"7Aqe2\/LqFL"\}\);/g,
    restoreEn: 'function $1($2,$3,$4){if($2!=="default")return $2;let $5=$3.formatMessage({defaultMessage:"Default",id:"7Aqe2/LqFL"});',
    intlKey: 'sessionAsyncOutStyleMap'
  },
  {
    id: 'sidebar-view-all-tooltip',
    description: '侧边栏跳转详情悬浮提示词 (View all ➔ 查看全部)',
    enGuard: '="View all"',
    zhGuard: '="查看全部"',
    enPattern: /([a-zA-Z0-9_$]+)="View all"/g,
    zhSnippet: '$1="查看全部"',
    zhPattern: /([a-zA-Z0-9_$]+)="查看全部"/g,
    restoreEn: '$1="View all"',
    intlKey: 'pFK6bJU0EM'
  },
  {
    id: 'activity-token-books-mapping',
    description: '活动热力图阅读量对比世界名著书名汉化 (Moby-Dick 等)',
    enGuard: 'Moby-Dick',
    zhGuard: '白鲸',
    enPattern: /\{name:"The Little Prince",tokens:22e3\},(?:.*?)\{name:"War and Peace",tokens:73e4\}/g,
    zhSnippet: '{name:"小王子",tokens:22e3},{name:"老人与海",tokens:35e3},{name:"圣诞颂歌",tokens:37e3},{name:"动物庄园",tokens:39e3},{name:"华氏 451 度",tokens:6e4},{name:"了不起的盖茨比",tokens:62e3},{name:"五号屠场",tokens:64e3},{name:"美丽新世界",tokens:83e3},{name:"麦田里的守望者",tokens:95e3},{name:"哈利·波特与魔法石",tokens:103e3},{name:"霍比特人",tokens:123e3},{name:"1984",tokens:123e3},{name:"杀死一只知更鸟",tokens:13e4},{name:"傲慢与偏见",tokens:156e3},{name:"沙丘",tokens:244e3},{name:"白鲸",tokens:268e3},{name:"罪与罚",tokens:274e3},{name:"权力的游戏",tokens:381e3},{name:"安娜·卡列尼娜",tokens:468e3},{name:"堂吉诃德",tokens:52e4},{name:"魔戒",tokens:576e3},{name:"基督山伯爵",tokens:603e3},{name:"悲惨世界",tokens:689e3},{name:"战争与和平",tokens:73e4}',
    zhPattern: /name:"白鲸",tokens:268e3/g,
    restoreEn: '{name:"The Little Prince",tokens:22e3},{name:"The Old Man and the Sea",tokens:35e3},{name:"A Christmas Carol",tokens:37e3},{name:"Animal Farm",tokens:39e3},{name:"Fahrenheit 451",tokens:6e4},{name:"The Great Gatsby",tokens:62e3},{name:"Slaughterhouse-Five",tokens:64e3},{name:"Brave New World",tokens:83e3},{name:"The Catcher in the Rye",tokens:95e3},{name:"Harry Potter and the Philosopher\\u2019s Stone",tokens:103e3},{name:"The Hobbit",tokens:123e3},{name:"1984",tokens:123e3},{name:"To Kill a Mockingbird",tokens:13e4},{name:"Pride and Prejudice",tokens:156e3},{name:"Dune",tokens:244e3},{name:"Moby-Dick",tokens:268e3},{name:"Crime and Punishment",tokens:274e3},{name:"A Game of Thrones",tokens:381e3},{name:"Anna Karenina",tokens:468e3},{name:"Don Quixote",tokens:52e4},{name:"The Lord of the Rings",tokens:576e3},{name:"The Count of Monte Cristo",tokens:603e3},{name:"Les Mis\\u00E9rables",tokens:689e3},{name:"War and Peace",tokens:73e4}',
    intlKey: 'activityBooks'
  },
  {
    id: 'thinking-effort-options-mapping',
    description: '第三方推理配置默认思考强度下拉选项 (low/medium/high/xhigh/max ➔ 低/中/高/极高/最大)',
    enGuard: 'optionLabels',
    zhGuard: 'optionLabels',
    enPattern: /return\{value:([a-zA-Z0-9_$]+),label:([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\.meta\.optionLabels\?\.\[\1\]\)\?\?\1,disabled:/g,
    zhSnippet: 'return{value:$1,label:$2($3,$4.meta.optionLabels?.[$1])??({"low":"低","medium":"中","high":"高","xhigh":"极高","max":"最大"}[$1])??$1,disabled:',
    zhPattern: /(?:var _em=\{"low":"低","medium":"中","high":"高","xhigh":"极高","max":"最大"\};)?return\{value:([a-zA-Z0-9_$]+),label:([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\.meta\.optionLabels\?\.\[\1\]\)\?\?(?:_em\[\1\]|\(\{"low":"低","medium":"中","high":"高","xhigh":"极高","max":"最大"\}\[\1\]\))\?\?\1,disabled:/g,
    restoreEn: 'return{value:$1,label:$2($3,$4.meta.optionLabels?.[$1])??$1,disabled:',
    intlKey: 'effortOptionsMap'
  },
  {
    id: 'language-picker-zh-cn-display',
    description: '语言选择弹窗 zh-CN 原生标签 (中文（简体）)、灰色英文副标题 (Chinese (Simplified)) 及首位排序映射',
    enGuard: 'English (United States)',
    zhGuard: 'zh-CN',
    enPattern: /(?<!"zh-CN":\{name:"Chinese \(Simplified\)",localName:"[^"]+"\},)"en-US":\{name:"English \(United States\)",localName:"English \(United States\)"\}/g,
    zhSnippet: '"zh-CN":{name:"Chinese (Simplified)",localName:"\\u4E2D\\u6587\\uFF08\\u7B80\\u4F53\\uFF09"},"en-US":{name:"English (United States)",localName:"English (United States)"}',
    zhPattern: /"zh-CN":\{name:"Chinese \(Simplified\)",localName:"(?:\\u4E2D\\u6587\\uFF08\\u7B80\\u4F53\\uFF09|中文（简体）)"\},"en-US":\{name:"English \(United States\)",localName:"English \(United States\)"\}/g,
    restoreEn: '"en-US":{name:"English (United States)",localName:"English (United States)"}',
    intlKey: null
  },
  {
    id: 'builtin-cowork-skills-zh-description',
    description: '内置技能列表 (consolidate-memory/context/explain-usage/schedule/setup-claude/docx/pdf/pptx/xlsx/frontend-design) 前端中文简介无损映射',
    enGuard: 'getSupportedCommands',
    zhGuard: 'getSupportedCommands',
    enPattern: /(?:async function ([a-zA-Z0-9_$]+)\(\)\{return ([a-zA-Z0-9_$]+)\?\.getSupportedCommands\?\(await \2\.getSupportedCommands\(\)\)\.filter\(([a-zA-Z0-9_$]+)\):\[\]\}|\(await ([a-zA-Z0-9_$]+)\.getSupportedCommands\(\)\)\.filter\(([a-zA-Z0-9_$]+)=>\5\.scope==="cowork"\))(?!\.map\()/g,
    zhSnippet: (match, p1, p2, p3, p4, p5) => {
      const dictStr = '{"consolidate-memory":"回顾并整理您的记忆文件——合并重复项、修正过期信息、精简索引。","context":"显示当前上下文窗口的占用情况","explain-usage":"使用通俗语言和简洁图表解释本会话的 Token 消耗去向。","schedule":"创建或更新自动运行的定时任务（例如每天、每天早上或指定时间自动执行）。","setup-claude":"引导式设置——安装匹配的插件、体验技能并连接工具。","setup-cowork":"引导式设置——安装匹配的插件、体验技能并连接工具。","design":"使用 Claude Design (claude.ai/design)：创建、导入、导出、同步与登录","docx":"创建、读取、编辑或处理 Word 文档 (.docx) 与模板 (.dotx)——支持提取或重组内容、插入图片、查找替换、处理修订批注及生成精美文档。","frontend-design":"在构建新 UI 或重构现有界面时提供独具匠心的视觉设计指导，协助把控美学方向与排版布局，避免千篇一律的模板化设计。","pdf":"处理各类 PDF 文件——涵盖读取或提取文本与表格、合并或拆分页面、旋转、添加水印、创建 PDF、填写表单、加解密及扫描件 OCR 识别。","pdf-reading":"从磁盘读取、检查或提取 PDF 文件内容——涵盖内容盘点、文本提取、页面光栅化视觉检查、提取内嵌图片/表格/表单字段及文档读取策略选择。","pptx":"创建、读取、编辑或处理 PowerPoint (.pptx / .potx) 演示文稿——涵盖制作幻灯片与路演文稿、提取文本、合并拆分页面及管理母版版式与备注。","xlsx":"创建、读取、编辑或处理电子表格 (.xlsx / .xlsm / .csv / .tsv)——涵盖添加列、公式计算、格式美化、绘制图表、清洗杂乱数据及格式转换。"}';
      if (p1 && p2 && p3) {
        return `async function ${p1}(){return ${p2}?.getSupportedCommands?(await ${p2}.getSupportedCommands()).filter(${p3}).map(${p3}=>{var _sm=${dictStr};var _d=${p3}.description&&${p3}.description.includes("not available")?"引导式设置——根据您的组织策略不可用。":_sm[${p3}.name];return _d?{...${p3},description:_d}:${p3}}):[]}`;
      } else if (p4 && p5) {
        return `(await ${p4}.getSupportedCommands()).filter(${p5}=>${p5}.scope==="cowork").map(${p5}=>{var _sm=${dictStr};var _d=${p5}.description&&${p5}.description.includes("not available")?"引导式设置——根据您的组织策略不可用。":_sm[${p5}.name];return _d?{...${p5},description:_d}:${p5}})`;
      }
      return match;
    },
    zhPattern: /(?:async function ([a-zA-Z0-9_$]+)\(\)\{return ([a-zA-Z0-9_$]+)\?\.getSupportedCommands\?\(await \2\.getSupportedCommands\(\)\)\.filter\(([a-zA-Z0-9_$]+)\)\.map\(|\(await ([a-zA-Z0-9_$]+)\.getSupportedCommands\(\)\)\.filter\(([a-zA-Z0-9_$]+)=>\4\.scope==="cowork"\)\.map\()/g,
    restoreEn: (match, p1, p2, p3, p4) => {
      if (p1 && p2 && p3) {
        return `async function ${p1}(){return ${p2}?.getSupportedCommands?(await ${p2}.getSupportedCommands()).filter(${p3}):[]}`;
      } else if (p4) {
        return `(await ${p4}.getSupportedCommands()).filter(_item7=>_item7.scope==="cowork")`;
      }
      return match;
    },
    intlKey: null
  },
  {
    id: 'builtin-plugin-skills-zh-description',
    description: '内置打包插件技能 (docx/frontend-design/pdf/pdf-reading/pptx/xlsx) 前端中文简介无损映射',
    enGuard: '.skills.map',
    zhGuard: '.skills.map',
    enPattern: /([a-zA-Z0-9_$]+)\.skills\.map\(([a-zA-Z0-9_$]+)=>\(\{name:\2\.name,description:\2\.description,argumentHint:\2\.argumentHint,/g,
    zhSnippet: '$1.skills.map($2=>({name:$2.name,description:({"docx":"创建、读取、编辑或处理 Word 文档 (.docx) 与模板 (.dotx)——支持提取或重组内容、插入图片、查找替换、处理修订批注及生成精美文档。","frontend-design":"在构建新 UI 或重构现有界面时提供独具匠心的视觉设计指导，协助把控美学方向与排版布局，避免千篇一律的模板化设计。","pdf":"处理各类 PDF 文件——涵盖读取或提取文本与表格、合并或拆分页面、旋转、添加水印、创建 PDF、填写表单、加解密及扫描件 OCR 识别。","pdf-reading":"从磁盘读取、检查或提取 PDF 文件内容——涵盖内容盘点、文本提取、页面光栅化视觉检查、提取内嵌图片/表格/表单字段及文档读取策略选择。","pptx":"创建、读取、编辑或处理 PowerPoint (.pptx / .potx) 演示文稿——涵盖制作幻灯片与路演文稿、提取文本、合并拆分页面及管理母版版式与备注。","xlsx":"创建、读取、编辑或处理电子表格 (.xlsx / .xlsm / .csv / .tsv)——涵盖添加列、公式计算、格式美化、绘制图表、清洗杂乱数据及格式转换。"}[$2.name]||$2.description),argumentHint:$2.argumentHint,',
    zhPattern: /([a-zA-Z0-9_$]+)\.skills\.map\(([a-zA-Z0-9_$]+)=>\(\{name:\2\.name,description:\(\{"docx":"[^"]+",[^}]+\}\[\2\.name\]\|\|\2\.description\),argumentHint:\2\.argumentHint,/g,
    restoreEn: '$1.skills.map($2=>({name:$2.name,description:$2.description,argumentHint:$2.argumentHint,',
    intlKey: null
  },
  {
    id: 'builtin-api-skills-zh-description',
    description: '官方云端/组织内置技能列表 (creator_type=anthropic) 前端中文简介无损映射',
    enGuard: 'creator_type',
    zhGuard: 'creator_type',
    enPattern: /return\{skillId:([a-zA-Z0-9_$]+)\.id,skillName:\1\.name,skillDescription:\1\.description,creatorType:\1\.creator_type,/g,
    zhSnippet: 'return{skillId:$1.id,skillName:$1.name,skillDescription:($1.creator_type==="anthropic"&&{"docx":"创建、读取、编辑或处理 Word 文档 (.docx) 与模板 (.dotx)——支持提取或重组内容、插入图片、查找替换、处理修订批注及生成精美文档。","frontend-design":"在构建新 UI 或重构现有界面时提供独具匠心的视觉设计指导，协助把控美学方向与排版布局，避免千篇一律的模板化设计。","pdf":"处理各类 PDF 文件——涵盖读取或提取文本与表格、合并或拆分页面、旋转、添加水印、创建 PDF、填写表单、加解密及扫描件 OCR 识别。","pdf-reading":"从磁盘读取、检查或提取 PDF 文件内容——涵盖内容盘点、文本提取、页面光栅化视觉检查、提取内嵌图片/表格/表单字段及文档读取策略选择。","pptx":"创建、读取、编辑或处理 PowerPoint (.pptx / .potx) 演示文稿——涵盖制作幻灯片与路演文稿、提取文本、合并拆分页面及管理母版版式与备注。","xlsx":"创建、读取、编辑或处理电子表格 (.xlsx / .xlsm / .csv / .tsv)——涵盖添加列、公式计算、格式美化、绘制图表、清洗杂乱数据及格式转换。"}[$1.name])||$1.description,creatorType:$1.creator_type,',
    zhPattern: /return\{skillId:([a-zA-Z0-9_$]+)\.id,skillName:\1\.name,skillDescription:\(\1\.creator_type==="anthropic"&&\{"docx":"[^"]+",[^}]+\}\[\1\.name\]\)\|\|\1\.description,creatorType:\1\.creator_type,/g,
    restoreEn: 'return{skillId:$1.id,skillName:$1.name,skillDescription:$1.description,creatorType:$1.creator_type,',
    intlKey: null
  },
  {
    id: 'effort-slider-recommended-badge',
    description: '模型推理强度滑块刻度 Recommended 徽标汉化 (Recommended ➔ 推荐)',
    enGuard: 'badge?.message',
    zhGuard: 'm==="Recommended"?"推荐"',
    enPattern: /([a-zA-Z0-9_$]+)=([a-zA-Z0-9_$]+)\[([a-zA-Z0-9_$]+)\]\?\.badge\?\.message(?=,[a-zA-Z0-9_$]+=J4\()/g,
    zhSnippet: '$1=(function(m){return m==="Recommended"?"推荐":m})($2[$3]?.badge?.message)',
    zhPattern: /\(function\(m\)\{return m==="Recommended"\?"推荐":m\}\)\(([a-zA-Z0-9_$]+)\[([a-zA-Z0-9_$]+)\]\?\.badge\?\.message\)/g,
    restoreEn: '$1=$2[$3]?.badge?.message',
    intlKey: null
  },
  {
    id: 'effort-menu-recommended-badge',
    description: '模型推理强度二级菜单 Recommended 徽标汉化 (Recommended ➔ 推荐)',
    enGuard: 'badge?.message',
    zhGuard: 'message==="Recommended"?"推荐"',
    enPattern: /(?:([a-zA-Z0-9_$]+)=([a-zA-Z0-9_$]+)\.badge\?\.message\?\2\.badge:void 0)(?=,([a-zA-Z0-9_$]+)=(?:[a-zA-Z0-9_$]+\([^)]+\)|[a-zA-Z0-9_$]+\(\2\)))/g,
    zhSnippet: '$1=$2.badge?.message?{...$2.badge,message:$2.badge.message==="Recommended"?"推荐":$2.badge.message}:void 0',
    zhPattern: /\{(?:\.\.\.[a-zA-Z0-9_$]+\.badge,)?message:[a-zA-Z0-9_$]+\.badge\.message==="Recommended"\?"推荐":[a-zA-Z0-9_$]+\.badge\.message\}/g,
    restoreEn: '$1=$2.badge?.message?$2.badge:void 0',
    intlKey: null
  }
];

/**
 * 遍历注入指定目录下的所有 JS 文件 (语言白名单放宽、硬编码补丁、折叠长文档拦截与 AST 语法自检)
 */
function patchJsFiles(assetsDirectory, patchHits, options = {}) {
  const { isAsarMode = false, fileManifest = {} } = options;
  if (!assetsDirectory || !fs.existsSync(assetsDirectory)) return { count: 0, error: null };

  const jsFiles = fs.readdirSync(assetsDirectory).filter(f => f.endsWith('.js') && !f.endsWith('.orig.bak'));
  // 正则放宽：支持如 es-419 等含数字和符号的语言标识符
  const regexAdd = /\["en-US"(?:,"[a-zA-Z0-9_-]+")+\]/g;
  const longDocsPath = path.join(__dirname, '../dict/long-docs-zh-CN.json');
  const hasLongDocsFile = fs.existsSync(longDocsPath);
  const zFnDeclarationRegex = /function\s+([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)\{return\{text:\2,\.\.\.\3\}\}/g;
  const zFnArrowRegex = /([a-zA-Z0-9_$]+)=\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)=>\(\{text:\2,\.\.\.\3\}\)/g;
  const zFnAssignRegex = /function\s+([a-zA-Z0-9_$]+)\(([a-zA-Z0-9_$]+),([a-zA-Z0-9_$]+)\)\{return\s+Object\.assign\(\{text:\2\},\3\)\}/g;

  let jsPatchedCount = 0;

  for (const file of jsFiles) {
    const fullPath = path.join(assetsDirectory, file);
    const bakPath = `${fullPath}.orig.bak`;
    const current = fs.readFileSync(fullPath, 'utf8');

    let currentHash = null;
    const getCurrentHash = () => {
      if (currentHash === null) currentHash = getHash(current);
      return currentHash;
    };

    let content = current;

    if (!isAsarMode && fs.existsSync(bakPath)) {
      const bak = fs.readFileSync(bakPath, 'utf8');
      const bakHash = getHash(bak);

      const isOurPatched = (fileManifest[file] && getCurrentHash() === fileManifest[file].patchedHash) ||
                           current.includes(',"zh-CN"]') ||
                           current.includes('var __ZH_DOCS__=') ||
                           JS_LITERAL_PATCHES.some(p => {
                             const guard = p.zhGuard || p.enGuard;
                             if (guard && !current.includes(guard)) return false;
                             return safeTest(p.zhPattern, current);
                           });

      if (getCurrentHash() !== bakHash && !isOurPatched) {
        fs.copyFileSync(fullPath, bakPath);
        content = current;
      } else {
        content = bak;
      }
    }

    let newContent = content;
    let modified = false;

    // 1. 语言白名单正则放宽追加 ,"zh-CN"]
    if (newContent.includes('"en-US"')) {
      if (safeTest(regexAdd, newContent)) {
        newContent = newContent.replace(regexAdd, (match) => {
          if (match.includes('"zh-CN"')) return match;
          return match.slice(0, -1) + ',"zh-CN"]';
        });
        modified = true;
      }
    }

    // 2. 结构化硬编码补丁注入与命中统计
    for (const patch of JS_LITERAL_PATCHES) {
      const hasEnGuard = !patch.enGuard || newContent.includes(patch.enGuard);
      const hasZhGuard = !patch.zhGuard || newContent.includes(patch.zhGuard);
      if (!hasEnGuard && !hasZhGuard) {
        continue;
      }

      if (hasEnGuard && safeTest(patch.enPattern, newContent)) {
        newContent = newContent.replace(patch.enPattern, patch.zhSnippet);
        if (patchHits[patch.id] !== undefined) patchHits[patch.id]++;
        modified = true;
      } else if (hasZhGuard && safeTest(patch.zhPattern, newContent)) {
        if (patchHits[patch.id] !== undefined) patchHits[patch.id]++;
      }
    }

    // 3. 动态注入“了解更多”长篇折叠文档全局翻译拦截器
    if (hasLongDocsFile && newContent.includes('text:') && (safeTest(zFnDeclarationRegex, newContent) || safeTest(zFnArrowRegex, newContent) || safeTest(zFnAssignRegex, newContent))) {
      const longDocs = JSON.parse(fs.readFileSync(longDocsPath, 'utf8'));
      let hasInjectedHeader = newContent.includes('var __ZH_DOCS__=');
      let header = hasInjectedHeader ? '' : `var __ZH_DOCS__=${JSON.stringify(longDocs)},__ZH_CACHE__=Object.create(null);`;

      newContent = newContent.replace(zFnDeclarationRegex, (match, fnName, a1, a2) => {
        const repl = `${header}function ${fnName}(${a1},${a2}){if(typeof ${a1}!=="string")return{text:${a1},...${a2}};var tr=__ZH_CACHE__[${a1}];if(tr===undefined){tr=Object.hasOwn(__ZH_DOCS__,${a1})?__ZH_DOCS__[${a1}]:undefined;if(!tr&&${a1}.length>10){for(var k in __ZH_DOCS__){if(${a1}.indexOf(k)===0||(k.length>20&&${a1}.indexOf(k)!==-1)){tr=${a1}.replace(k,__ZH_DOCS__[k]);break;}}}__ZH_CACHE__[${a1}]=tr||null;}return{text:tr||${a1},...${a2}}}`;
        header = '';
        return repl;
      });

      newContent = newContent.replace(zFnArrowRegex, (match, fnName, a1, a2) => {
        const repl = `${header}${fnName}=(${a1},${a2})=>{if(typeof ${a1}!=="string")return{text:${a1},...${a2}};var tr=__ZH_CACHE__[${a1}];if(tr===undefined){tr=Object.hasOwn(__ZH_DOCS__,${a1})?__ZH_DOCS__[${a1}]:undefined;if(!tr&&${a1}.length>10){for(var k in __ZH_DOCS__){if(${a1}.indexOf(k)===0||(k.length>20&&${a1}.indexOf(k)!==-1)){tr=${a1}.replace(k,__ZH_DOCS__[k]);break;}}}__ZH_CACHE__[${a1}]=tr||null;}return{text:tr||${a1},...${a2}}}`;
        header = '';
        return repl;
      });

      newContent = newContent.replace(zFnAssignRegex, (match, fnName, a1, a2) => {
        const repl = `${header}function ${fnName}(${a1},${a2}){if(typeof ${a1}!=="string")return Object.assign({text:${a1}},${a2});var tr=__ZH_CACHE__[${a1}];if(tr===undefined){tr=Object.hasOwn(__ZH_DOCS__,${a1})?__ZH_DOCS__[${a1}]:undefined;if(!tr&&${a1}.length>10){for(var k in __ZH_DOCS__){if(${a1}.indexOf(k)===0||(k.length>20&&${a1}.indexOf(k)!==-1)){tr=${a1}.replace(k,__ZH_DOCS__[k]);break;}}}__ZH_CACHE__[${a1}]=tr||null;}return Object.assign({text:tr||${a1}},${a2})}`;
        header = '';
        return repl;
      });

      modified = true;
    }

    if (modified && newContent !== content) {
      // 核心安全防御：AST 语法自检防火墙 (防止破坏 JS 语法导致客户端黑屏崩溃)
      const syntaxCheck = validateJsSyntax(newContent);
      if (!syntaxCheck.valid) {
        console.error(`❌ [AST 语法防火墙拦截] 补丁导致 ${file} 出现语法错误，已安全拒绝写入！`);
        console.error(syntaxCheck.error);
        return {
          count: jsPatchedCount,
          error: `补丁注入后检测到语法错误 (${file}): ${syntaxCheck.error}。为防止客户端黑屏，已终止注入并保持原版。`
        };
      }

      if (!isAsarMode) {
        if (!fs.existsSync(bakPath)) {
          fs.copyFileSync(fullPath, bakPath);
        }
        fileManifest[file] = {
          originalHash: getHash(content),
          patchedHash: getHash(newContent)
        };
      }

      fs.writeFileSync(fullPath, newContent, 'utf8');
      jsPatchedCount++;
    }
  }

  return { count: jsPatchedCount, error: null };
}

function applyPatch(options = {}) {
  const info = getClaudeInstallation(options.customPath);
  if (!options.customPath && isClaudeRunning()) {
    if (!options.autoClose || !closeClaude() || isClaudeRunning()) return { success: false, error: '客户端仍在运行，请保存工作并退出后重试。' };
  }
  if (info.resourcesPath && fs.existsSync(path.join(info.resourcesPath, 'ion-dist.asar')) && !info.hasNativeChinese) {
    if (info.distribution === 'store') return { success: false, error: '暂不支持 Microsoft Store 分发版本，请使用官网安装器。' };
    if (!fs.existsSync(path.join(path.dirname(info.resourcesPath), 'claude.exe'))) return { success: false, error: '此 ASAR 布局缺少可验证的 Windows 主程序，暂不支持注入；其他平台仅保留散装资源布局支持。' };
    if (!canWriteDirectory(info.resourcesPath) || !canWriteDirectory(path.dirname(info.resourcesPath))) {
      if (!grantPermissions(info.resourcesPath)) return { success: false, error: '目录写权限不足，请以管理员身份运行安装脚本。' };
    }
    return applyAsarTransaction(info, options, applyPatchDirect);
  }
  return applyPatchDirect(options);
}

function applyPatchDirect(options = {}) {
  const info = getClaudeInstallation(options.customPath);

  if (!info.installPath || !info.resourcesPath) {
    return {
      success: false,
      error: '未找到 Claude 客户端安装路径。请确保已安装 Claude Desktop。'
    };
  }

  // 1. 官方中文自动检测与优雅让位机制
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
    if (!closeClaude() || isClaudeRunning()) return { success: false, error: '客户端仍在运行，请先保存工作并退出。' };
    processAutoClosed = true;
  }

  const resDir = info.resourcesPath;
  const asarPath = path.join(resDir, 'ion-dist.asar');
  const isAsarMode = fs.existsSync(asarPath);
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');
  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');
  const appDir = path.dirname(resDir);
  const exePath = path.join(appDir, 'claude.exe');

  // 3. 独立安全权限收敛：无论当前目录是否可写，均无条件先行清理历史版本可能残留的高危 Users 组显式权限
  sanitizePermissions(resDir);

  // 4. 检查并提权（同时覆盖 app 目录与 resources 目录，确保可修改 claude.exe 与 ion-dist.asar）
  const needsPerm = !canWriteDirectory(resDir) ||
                    (isAsarMode && fs.existsSync(exePath) && !canWriteDirectory(appDir)) ||
                    (!isAsarMode && fs.existsSync(assetsDir) && !canWriteDirectory(assetsDir));

  if (needsPerm) {
    grantPermissions(resDir);
    if (!canWriteDirectory(resDir) || (isAsarMode && fs.existsSync(exePath) && !canWriteDirectory(appDir))) {
      return {
        success: false,
        error: '目录写权限不足。请右键点击 install.bat 选择【以管理员身份运行】。'
      };
    }
  }

  try {
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

    const shellZhPath = path.join(__dirname, '../dict/zh-CN.json');
    const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
    const dynZhPath = path.join(__dirname, '../dict/dynamic-zh-CN.json');

    const shellZh = fs.existsSync(shellZhPath) ? JSON.parse(fs.readFileSync(shellZhPath, 'utf8')) : {};
    const ionZh = fs.existsSync(ionZhPath) ? JSON.parse(fs.readFileSync(ionZhPath, 'utf8')) : {};
    const dynZh = fs.existsSync(dynZhPath) ? JSON.parse(fs.readFileSync(dynZhPath, 'utf8')) : {};
    for (const [layer, dictionary] of [['shell', shellZh], ['ion', ionZh], ['dynamic', dynZh]]) {
      for (const [key, text] of Object.entries(dictionary)) {
        const check = typeof text === 'string' ? validateSyntax(text) : { valid: false, errors: ['词条不是字符串'] };
        if (!check.valid) throw new Error(`${layer} 词条 ${key} 的 ICU 语法无效: ${check.errors.join('; ')}`);
      }
    }
    const verifyPairs = (base, translated) => {
      for (const [key, text] of Object.entries(translated)) {
        if (!Object.hasOwn(base, key)) continue;
        const check = validatePair(key, base[key], text);
        if (!check.valid) throw new Error(`词条 ${key} 与当前英文 ICU 结构不匹配: ${check.errors.join('; ')}`);
      }
    };

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

      if (fs.existsSync(enPath)) {
        try {
          const content = fs.readFileSync(enPath, 'utf8');
          if (isEnUsClean(content)) {
            baseEn = JSON.parse(content);
          }
        } catch (e) {}
      }

      if (Object.keys(baseEn).length === 0 && fs.existsSync(bakPath)) {
        try {
          const bakContent = fs.readFileSync(bakPath, 'utf8');
          if (isEnUsClean(bakContent)) {
            baseEn = JSON.parse(bakContent);
          }
        } catch (e) {}
      }

      verifyPairs(baseEn, zhDict);
      const merged = Object.assign({}, baseEn, zhDict);
      fs.writeFileSync(path.join(targetDir, 'zh-CN.json'), JSON.stringify(merged), 'utf8');
      return merged;
    };

    // -------------------------------------------------------------
    // 方案 A: ASAR 模式 (Claude 4.x 封装架构)
    // -------------------------------------------------------------
    if (isAsarMode) {
      const asarBakPath = path.join(resDir, 'ion-dist.asar.orig.bak');
      const exeBakPath = path.join(appDir, 'claude.exe.orig.bak');

      // 1. 首次创建纯净出厂备份
      if (fs.existsSync(exePath) && !fs.existsSync(exeBakPath)) {
        fs.copyFileSync(exePath, exeBakPath);
      }
      if (!fs.existsSync(asarBakPath)) {
        fs.copyFileSync(asarPath, asarBakPath);
      }

      // 2. 提取源永远优先使用纯净出厂备份，保证幂等与基线纯度
      const sourceAsar = fs.existsSync(asarBakPath) ? asarBakPath : asarPath;
      const tmpWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ion-dist-'));
      const tmpExtractDir = path.join(tmpWorkDir, 'ion');
      fs.mkdirSync(tmpExtractDir);

      try {
        asar.extractAll(sourceAsar, tmpExtractDir);

        // 3. 注入前端 JS 资源
        const tmpAssets = path.join(tmpExtractDir, 'assets', 'v1');
        const patchRes = patchJsFiles(tmpAssets, patchHits, { isAsarMode: true });
        if (patchRes.error) {
          return { success: false, error: patchRes.error };
        }
        jsPatchedCount = patchRes.count;

        // 4. 基于当前英文生成中文目录，保持原版英文不变
        const tmpI18n = path.join(tmpExtractDir, 'i18n');
        const tmpDyn = path.join(tmpI18n, 'dynamic');

        if (fs.existsSync(tmpI18n)) {
          let baseIonEn = {};
          const enPath = path.join(tmpI18n, 'en-US.json');
          if (fs.existsSync(enPath)) {
            try {
              const c = fs.readFileSync(enPath, 'utf8');
              if (isEnUsClean(c)) baseIonEn = JSON.parse(c);
            } catch (e) {}
          }
          verifyPairs(baseIonEn, ionZh);
          const mergedIon = Object.assign({}, baseIonEn, ionZh);
          fs.writeFileSync(path.join(tmpI18n, 'zh-CN.json'), JSON.stringify(mergedIon), 'utf8');
          fs.writeFileSync(path.join(tmpI18n, 'zh-CN.overrides.json'), '{}\n', 'utf8');
          // Keep the official English catalog available as a real fallback.
        }

        if (fs.existsSync(tmpDyn)) {
          let baseDynEn = {};
          const dynEnPath = path.join(tmpDyn, 'en-US.json');
          if (fs.existsSync(dynEnPath)) {
            try {
              const c = fs.readFileSync(dynEnPath, 'utf8');
              if (isEnUsClean(c)) baseDynEn = JSON.parse(c);
            } catch (e) {}
          }
          verifyPairs(baseDynEn, dynZh);
          const mergedDyn = Object.assign({}, baseDynEn, dynZh);
          fs.writeFileSync(path.join(tmpDyn, 'zh-CN.json'), JSON.stringify(mergedDyn), 'utf8');
          // Keep dynamic/en-US.json unchanged as well.
        }

        // 5. 打包新 ion-dist.asar 到临时文件并计算 Header SHA256
        const newIonAsarTmp = path.join(tmpWorkDir, 'ion-dist.asar');
        packAsarSync(tmpExtractDir, newIonAsarTmp);
        const newIonSha256 = getRawHeaderSha256(newIonAsarTmp);

        // 6. 注入 Shell 外壳菜单到 app.asar (解决 4.x 下 File/Edit/View/Help 等系统菜单显示为英文的问题)
        const appAsarPath = path.join(resDir, 'app.asar');
        const appAsarBakPath = path.join(resDir, 'app.asar.orig.bak');
        let newAppAsarTmp = null;
        let newAppSha256 = null;

        if (fs.existsSync(appAsarPath) || fs.existsSync(appAsarBakPath)) {
          if (fs.existsSync(appAsarBakPath)) {
            // 确保以官方纯净原版为基准进行解压，消除历史残缺注入干扰
            fs.copyFileSync(appAsarBakPath, appAsarPath);
          } else {
            fs.copyFileSync(appAsarPath, appAsarBakPath);
          }

          const tmpAppExtract = path.join(tmpWorkDir, 'app');
          fs.mkdirSync(tmpAppExtract);
          try {
            if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
            asar.extractAll(appAsarPath, tmpAppExtract);

            // A. 注入 i18n 多语言包
            const appI18nDir = path.join(tmpAppExtract, 'resources', 'i18n');
            if (fs.existsSync(appI18nDir)) {
              let baseAppZh = {};
              const appZhPath = path.join(appI18nDir, 'zh-CN.json');
              const appEnPath = path.join(appI18nDir, 'en-US.json');
              if (fs.existsSync(appZhPath)) {
                try { baseAppZh = JSON.parse(fs.readFileSync(appZhPath, 'utf8')); } catch (_) {}
              } else if (fs.existsSync(appEnPath)) {
                try {
                  const c = fs.readFileSync(appEnPath, 'utf8');
                  if (isEnUsClean(c)) baseAppZh = JSON.parse(c);
                } catch (_) {}
              }
              verifyPairs(baseAppZh, shellZh);
              const mergedApp = Object.assign({}, baseAppZh, shellZh);
              const compactApp = JSON.stringify(mergedApp);
              fs.writeFileSync(appZhPath, compactApp, 'utf8');
              fs.writeFileSync(path.join(appI18nDir, 'zh-Hans.json'), compactApp, 'utf8');
              // Do not replace the English catalog to hide locale-selection drift.
            }

            // B. 注册主进程中文语言，保留默认英文回退
            const viteBuildDir = path.join(tmpAppExtract, '.vite', 'build');
            let shellLocaleMaps = 0;
            if (fs.existsSync(viteBuildDir)) {
              const jsFiles = fs.readdirSync(viteBuildDir).filter(f => f.endsWith('.js'));
              for (const f of jsFiles) {
                const fullF = path.join(viteBuildDir, f);
                let content = fs.readFileSync(fullF, 'utf8');
                const patched = patchShellLocale(content);
                shellLocaleMaps += patched.mapCount;
                if (patched.content !== content) {
                  const syntax = validateJsSyntax(patched.content);
                  if (!syntax.valid) throw new Error(`主进程语言补丁语法校验失败 (${f}): ${syntax.error}`);
                  fs.writeFileSync(fullF, patched.content, 'utf8');
                }
              }
            }
            if (fs.existsSync(appI18nDir) && shellLocaleMaps !== 1) {
              throw new Error(`主进程语言注册未通过验证 (${shellLocaleMaps} 个匹配)，上游结构可能已变更。`);
            }

            // C. 重新打包 app.asar 并保持原生模块 unpacked
            newAppAsarTmp = path.join(tmpWorkDir, 'app.asar');
            const unpacked = asar.listPackage(appAsarPath).filter(entry => {
              const stat = asar.statFile(appAsarPath, entry.replace(/^[\\/]/, ''));
              return stat.unpacked && !stat.files;
            });
            const unpackPaths = unpacked.map(entry => '**/' + entry.replace(/^[\\/]/, '').replace(/\\/g, '/'));
            const unpack = unpackPaths.length > 1 ? `{${unpackPaths.join(',')}}` : unpackPaths[0];
            packAsarSync(tmpAppExtract, newAppAsarTmp, { unpack });
            const repackedUnpacked = asar.listPackage(newAppAsarTmp).filter(entry => {
              const stat = asar.statFile(newAppAsarTmp, entry.replace(/^[\\/]/, ''));
              return stat.unpacked && !stat.files;
            });
            if (JSON.stringify(unpacked.sort()) !== JSON.stringify(repackedUnpacked.sort())) throw new Error('原生模块 unpacked 布局发生变化，已停止安装。');
            newAppSha256 = getRawHeaderSha256(newAppAsarTmp);
          } finally {
            try { fs.rmSync(tmpAppExtract, { recursive: true, force: true }); } catch (_) {}
          }
        }

        // 7. 同步主程序中的 ASAR 哈希，保持熔丝原样
        if (fs.existsSync(exePath)) {
          const hashesToPatch = { 'ion-dist.asar': newIonSha256 };
          if (newAppSha256) {
            hashesToPatch['app.asar'] = newAppSha256;
          }
          const exeRes = patchClaudeExe(exePath, hashesToPatch);
          if (!exeRes.success) {
            try { fs.unlinkSync(newIonAsarTmp); } catch (_) {}
            if (newAppAsarTmp) { try { fs.unlinkSync(newAppAsarTmp); } catch (_) {} }
            return {
              success: false,
              error: `同步主程序完整性记录失败: ${exeRes.error}。为防止客户端崩溃闪退，已安全中止注入并保持原版。`
            };
          }
        }

        // 8. 确认二进制破解就绪后，执行新 ion-dist.asar 与 app.asar 的原子落盘替换
        fs.copyFileSync(newIonAsarTmp, asarPath);
        if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
        try { fs.unlinkSync(newIonAsarTmp); } catch (_) {}

        if (newAppAsarTmp && fs.existsSync(newAppAsarTmp)) {
          fs.copyFileSync(newAppAsarTmp, appAsarPath);
          if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
          try { fs.unlinkSync(newAppAsarTmp); } catch (_) {}
        }
      } finally {
        try { fs.rmSync(tmpWorkDir, { recursive: true, force: true }); } catch (_) {}
      }
    } else {
      // -------------------------------------------------------------
      // 方案 B: 散装目录模式 (Claude 3.x 散装目录向后兼容)
      // -------------------------------------------------------------
      if (fs.existsSync(assetsDir)) {
        const patchRes = patchJsFiles(assetsDir, patchHits, { isAsarMode: false, fileManifest });
        if (patchRes.error) {
          return { success: false, error: patchRes.error };
        }
        jsPatchedCount = patchRes.count;
      }

      // 注入 Ion-Dist Web UI 层 zh-CN.json + zh-CN.overrides.json
      if (fs.existsSync(i18nDir)) {
        createIncrementalZh(i18nDir, ionZh);
        fs.writeFileSync(path.join(i18nDir, 'zh-CN.overrides.json'), '{}\n', 'utf8');
      }

      // 注入 Dynamic 层 zh-CN.json
      if (fs.existsSync(dynDir)) {
        createIncrementalZh(dynDir, dynZh);
      }
    }

    const warnings = [];
    for (const patch of JS_LITERAL_PATCHES) {
      if (patchHits[patch.id] === 0 && !patch.intlKey) {
        warnings.push(`[硬编码补丁未命中] ${patch.id} (${patch.description}): 上游代码结构可能已发生变更`);
      }
    }

    // A. 注入 Shell 外壳层 zh-CN.json
    if (!isAsarMode) createIncrementalZh(resDir, shellZh);

    // 官方外壳 en-US 权威保护与防旧备份覆盖降级熔断
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
        if (fs.existsSync(bakPath)) {
          try { fs.unlinkSync(bakPath); } catch (e) {}
        }
      }
    };

    if (!isAsarMode) sanitizeEnUS(resDir, path.join(__dirname, '../dict/en-US.base.json'));

    // 写入元数据与文件哈希清单
    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
    const meta = {
      ...localizationFingerprint(),
      patchedAt: new Date().toISOString(),
      version: info.version,
      type: info.type,
      jsPatchedCount,
      totalEntries: Object.keys(ionZh).length,
      mode: isAsarMode ? 'asar_repack' : 'incremental_overlay',
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
        mode: meta.mode
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
  if (!options.customPath && isClaudeRunning()) {
    if (!options.autoClose || !closeClaude() || isClaudeRunning()) return { success: false, error: '客户端仍在运行，请保存工作并退出后重试。' };
  }

  if (info.resourcesPath && fs.existsSync(path.join(info.resourcesPath, 'ion-dist.asar'))) {
    if (info.distribution === 'store') return { success: false, error: '暂不支持修改 Microsoft Store 分发版本。' };
    if (!canWriteDirectory(info.resourcesPath) || !canWriteDirectory(path.dirname(info.resourcesPath))) {
      if (!grantPermissions(info.resourcesPath)) return { success: false, error: '目录写权限不足，请以管理员身份运行还原脚本。' };
    }
    return restoreAsarTransaction(info);
  }

  if (!info.installPath || !info.resourcesPath) {
    return {
      success: false,
      error: '未找到 Claude 客户端安装路径。'
    };
  }

  const resDir = info.resourcesPath;
  const asarPath = path.join(resDir, 'ion-dist.asar');
  const asarBakPath = path.join(resDir, 'ion-dist.asar.orig.bak');
  const appDir = path.dirname(resDir);
  const exePath = path.join(appDir, 'claude.exe');
  const exeBakPath = path.join(appDir, 'claude.exe.orig.bak');

  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');

  // 0. 独立安全权限收敛：无论当前目录是否可写，均无条件先行清理历史版本可能残留的高危 Users 组显式权限
  sanitizePermissions(resDir);

  if (!canWriteDirectory(resDir)) {
    grantPermissions(resDir);
  }

  try {
    const metaFile = path.join(resDir, '.claude_chinese_meta.json');
    let existingMeta = {};
    if (fs.existsSync(metaFile)) {
      try { existingMeta = JSON.parse(fs.readFileSync(metaFile, 'utf8')) || {}; } catch (e) {}
    }
    const fileManifest = existingMeta.files || {};

    const appAsarPath = path.join(resDir, 'app.asar');
    const appAsarBakPath = path.join(resDir, 'app.asar.orig.bak');

    // 1. ASAR 模式权威物理出厂恢复 (还原 claude.exe, ion-dist.asar 与 app.asar)
    if (fs.existsSync(asarBakPath) || fs.existsSync(exeBakPath) || fs.existsSync(appAsarBakPath)) {
      if (fs.existsSync(exeBakPath) && fs.existsSync(exePath)) {
        if (!canWriteDirectory(appDir)) {
          grantPermissions(appDir);
        }
        fs.copyFileSync(exeBakPath, exePath);
        try { fs.unlinkSync(exeBakPath); } catch (_) {}
      }
      if (fs.existsSync(asarBakPath) && fs.existsSync(asarPath)) {
        fs.copyFileSync(asarBakPath, asarPath);
        if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
        try { fs.unlinkSync(asarBakPath); } catch (_) {}
      }
      if (fs.existsSync(appAsarBakPath) && fs.existsSync(appAsarPath)) {
        fs.copyFileSync(appAsarBakPath, appAsarPath);
        if (typeof asar.uncacheAll === 'function') asar.uncacheAll();
        try { fs.unlinkSync(appAsarBakPath); } catch (_) {}
      }
    }

    // 2. 增量清理注入的中文文件与元数据
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

    // 3. 散装目录模式权威物理出厂恢复：从 .orig.bak 还原官方被修改 JS 资源
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
                               JS_LITERAL_PATCHES.some(p => {
                                 const guard = p.zhGuard || p.enGuard;
                                 if (guard && !current.includes(guard)) return false;
                                 return safeTest(p.zhPattern, current);
                               });

          if (isOurPatched) {
            fs.copyFileSync(bakPath, fullPath);
          }
          fs.unlinkSync(bakPath);
        } else {
          // 兜底正则清理
          let content = fs.readFileSync(fullPath, 'utf8');
          const hasAnyZhFeature = content.includes(',"zh-CN"]') ||
                                  content.includes('__ZH_DOCS__') ||
                                  JS_LITERAL_PATCHES.some(p => p.zhGuard && content.includes(p.zhGuard));
          if (!hasAnyZhFeature) {
            continue;
          }

          let modified = false;
          if (content.includes(',"zh-CN"]')) {
            content = content.replace(',"zh-CN"]', ']');
            modified = true;
          }
          for (const patch of JS_LITERAL_PATCHES) {
            if ((!patch.zhGuard || content.includes(patch.zhGuard)) && safeTest(patch.zhPattern, content)) {
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

    // 4. 安全权限出厂收敛：清理可能残留的 Users 组显式提权，恢复系统初始受限只读继承
    sanitizePermissions(resDir);

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
  safeTest,
  patchJsFiles,
  patchClaudeExe,
  packAsarSync,
  getRawHeaderSha256
};
