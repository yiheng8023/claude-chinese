#!/usr/bin/env node

/**
 * claude-chinese 一体化命令行入口 (CLI)
 */
const { getClaudeInstallation } = require('./core/msix-detector');
const { applyPatch, restorePatch } = require('./core/patcher');
const { runPreflightCheck } = require('./core/preflight');
const { runDriftDetection } = require('./tools/drift-detector');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0] || 'status';

function getCustomPath() {
  const pathIdx = args.indexOf('--path');
  if (pathIdx !== -1 && args[pathIdx + 1]) {
    return args[pathIdx + 1];
  }
  return null;
}

function showHelp() {
  console.log(`
Claude 桌面客户端轻量级自愈型中文汉化工具包 (claude-chinese)

用法:
  node cli.js [命令] [--path <自定义安装路径>]

可用命令:
  status         检查 Claude 客户端安装与汉化补丁状态
  check          执行前置环境全维预检 (Node 弹性版本、客户端安装、进程锁定与权限)
  install        注入中文汉化补丁 (支持 MSIX / Win32 / macOS / Linux)
  restore        还原为官方英文原版
  drift          执行上游版本文本漂移分析 (Drift Detection)
  launch         自愈式启动 Claude (检测并自动补齐汉化后启动)
  help           显示此帮助信息
`);
}

function handlePreflight() {
  console.log('=== 执行前置环境全维健康预检 (Pre-flight Health Check) ===\n');
  const customPath = getCustomPath();
  const preflight = runPreflightCheck({ customPath, autoClose: false });

  for (const c of preflight.checks) {
    const icon = c.passed ? '✅' : (c.critical ? '❌' : '⚠️');
    console.log(`  ${icon} [${c.name}]: ${c.detail}`);
  }

  if (preflight.allPassed) {
    console.log('\n🎉 所有核心前置条件 100% 就绪，可直接执行安装！');
  } else {
    console.log('\n❌ 部分核心前置条件未满足，请根据上方提示调整环境后再试。');
  }
}

function handleStatus() {
  console.log('=== Claude 客户端状态检查 ===\n');
  const customPath = getCustomPath();
  const info = getClaudeInstallation(customPath);

  if (!info.installPath) {
    console.log('❌ 未检测到已安装的 Claude 桌面客户端。');
    return;
  }

  console.log(`💻 操作系统: ${info.platform}`);
  console.log(`📦 安装类型: ${info.type.toUpperCase()}`);
  console.log(`🏷️ 客户端版本: ${info.version || '未知'}`);
  console.log(`📂 安装路径: ${info.installPath}`);
  console.log(`📁 资源路径: ${info.resourcesPath}`);

  if (info.hasNativeChinese) {
    console.log('\n🎉 汉化状态: 官方原生支持 (Native Official Chinese)');
    console.log('💡 Anthropic 官方已内置简体中文，工具包自动优雅让位。');
  } else if (info.isPatched) {
    console.log('\n🟢 汉化状态: 已增量挂载汉化 (Patched - 中文界面就绪)');
  } else {
    console.log('\n🟡 汉化状态: 未汉化 / 原版英文 (Original)');
    console.log('💡 运行 "node cli.js install" 或双击 "install.bat" 即可一键汉化。');
  }
}

function handleInstall() {
  console.log('=== 开始安装 Claude 中文汉化补丁 ===\n');
  const customPath = getCustomPath();

  console.log('🔍 [1/3] 正在执行前置环境全维预检...');
  const preflight = runPreflightCheck({ customPath });
  for (const c of preflight.checks) {
    const icon = c.passed ? '✅' : (c.critical ? '❌' : '⚠️');
    console.log(`  ${icon} ${c.name}: ${c.detail}`);
  }

  if (!preflight.allPassed) {
    console.error('\n❌ 前置条件检查未通过，安装中止。请根据上方排查环境。');
    return;
  }

  console.log('\n⚙️ [2/3] 正在应用增量汉化补丁与 JS 注入...');
  const result = applyPatch({ customPath });

  if (result.success) {
    if (result.nativeSupported) {
      console.log(result.message);
    } else {
      console.log('\n📦 [3/3] 汉化挂载完成！');
      console.log('✅ 增量汉化补丁挂载成功（保留官方原版英文为纯净兜底）！');
      console.log(`📦 适配版本: ${result.info.version}`);
      console.log(`🇨🇳 已汉化词条数: ${result.info.entriesCount}`);
      if (result.info.warnings && result.info.warnings.length > 0) {
        console.log('\n⚠️ 注意 (存在潜在代码漂移项):');
        result.info.warnings.forEach(w => console.log(`   - ${w}`));
      }
      console.log('\n🎉 请重启 Claude 桌面客户端查看中文界面。');
    }
  } else {
    console.error(`❌ 汉化失败: ${result.error}`);
  }
}

function handleRestore() {
  console.log('=== 正在还原官方英文原版 ===\n');
  const customPath = getCustomPath();
  const result = restorePatch({ customPath });

  if (result.success) {
    console.log('✅ 还原成功！已恢复官方英文界面。');
  } else {
    console.error(`❌ 还原失败: ${result.error}`);
  }
}

function handleDrift() {
  console.log('=== 执行版本漂移检测 (Drift Scan) ===\n');
  const report = runDriftDetection(args[1]);
  console.log(`📊 官方词条总量: ${report.totalUpstreamKeys}`);
  console.log(`🇨🇳 汉化覆盖率: ${report.coverage} (${report.matchedKeysCount} / ${report.totalUpstreamKeys})`);
  console.log(`✨ 新增未汉化词条: ${report.newKeysCount}`);
  console.log(`🗑️ 废弃词条: ${report.staleKeysCount}`);
}

function handleLaunch() {
  const customPath = getCustomPath();
  const info = getClaudeInstallation(customPath);

  if (!info.isPatched) {
    console.log('⚡ 检测到汉化尚未挂载，正在执行静默自愈注入...');
    applyPatch({ customPath });
  }

  console.log('🚀 正在启动 Claude 客户端...');

  if (process.platform === 'win32') {
    if (info.type === 'msix' && info.packageFamilyName) {
      execSync(`start shell:AppsFolder\\${info.packageFamilyName}!Claude`, { stdio: 'ignore' });
    } else if (info.installPath) {
      const exePath = path.join(info.installPath, 'Claude.exe');
      if (fs.existsSync(exePath)) {
        spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
      }
    }
  } else if (process.platform === 'darwin') {
    execSync('open -a "Claude"', { stdio: 'ignore' });
  } else {
    // Linux (claude-desktop / claude)
    try {
      const child = spawn('claude-desktop', [], { detached: true, stdio: 'ignore' });
      child.on('error', () => {
        spawn('claude', [], { detached: true, stdio: 'ignore' }).unref();
      });
      child.unref();
    } catch (e) {}
  }
}

function handleWatch() {
  console.log('=== 启动 Claude 中文汉化热重载与自愈守护进程 (Hot-Reload Daemon) ===\n');
  const customPath = getCustomPath();
  const info = getClaudeInstallation(customPath);

  if (!info.installPath || !info.resourcesPath) {
    console.error('❌ 未找到 Claude 客户端安装路径。请确保已安装 Claude Desktop。');
    return;
  }

  // 1. 初次静默自愈注入
  if (!info.isPatched) {
    console.log('⚡ 检测到当前未安装汉化，正在执行初始热注入...');
    applyPatch({ customPath, autoClose: false });
    console.log('✅ 初始汉化挂载完成！\n');
  }

  console.log(`📁 监听项目词库: ${path.join(__dirname, 'dict')}`);
  console.log(`📁 监听客户端资源: ${info.resourcesPath}`);
  console.log('💡 守护特性已激活:');
  console.log('   1. 词库热更新: 编辑本地 dict/*.json 后，在客户端按 Ctrl+R 即可秒级生效最新翻译！');
  console.log('   2. 官方自愈守卫: 检测到 Claude 官方静默覆盖更新时，自动重打补丁自愈恢复中文！\n');
  console.log('👀 守护进程运行中 (按 Ctrl+C 退出)...');

  let debounceTimer = null;
  let stabilityCheckTimer = null;

  const triggerHotReload = (reason, isUpstreamChange = false) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (stabilityCheckTimer) clearTimeout(stabilityCheckTimer);

    // 对于本地词典变更，300ms 快速响应；对于上游更新，增加 800ms 静稳窗口以防写入冲突
    const delay = isUpstreamChange ? 800 : 300;

    debounceTimer = setTimeout(() => {
      // 官方更新场景：检查文件是否写入完成 (连续检测 mtime/size 稳定)
      if (isUpstreamChange && info.resourcesPath) {
        const enFile = path.join(info.resourcesPath, 'en-US.json');
        let initialSize = -1;
        try { if (fs.existsSync(enFile)) initialSize = fs.statSync(enFile).size; } catch (e) {}

        stabilityCheckTimer = setTimeout(() => {
          let currentSize = -1;
          try { if (fs.existsSync(enFile)) currentSize = fs.statSync(enFile).size; } catch (e) {}
          if (initialSize !== currentSize && currentSize !== -1) {
            console.log('⏳ 官方更新器仍在写入文件，等待下一个静稳窗口...');
            return triggerHotReload(reason, true);
          }
          executePatch(reason);
        }, 500);
      } else {
        executePatch(reason);
      }
    }, delay);
  };

  const executePatch = (reason) => {
    console.log(`\n🔔 [${new Date().toLocaleTimeString()}] 检测到变动: ${reason}`);
    console.log('⚡ 正在执行增量热重载与自愈注入...');
    try {
      const result = applyPatch({ customPath, autoClose: false });
      if (result.success) {
        console.log(`🎉 热重载完成 (已挂载 ${result.info.entriesCount} 词条)！在 Claude 中按 Ctrl+R 即可查看最新界面。`);
      }
    } catch (err) {
      console.error('⚠️ 热重载同步异常:', err.message);
    }
  };

  // 监听本地 dict 目录变更 (词典热更新)
  const dictDir = path.join(__dirname, 'dict');
  if (fs.existsSync(dictDir)) {
    fs.watch(dictDir, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.json')) {
        triggerHotReload(`本地词库更新 (${filename})`, false);
      }
    });
  }

  // 监听客户端 resources 目录变更 (官方升级自愈)
  const resDir = info.resourcesPath;
  if (fs.existsSync(resDir)) {
    fs.watch(resDir, (eventType, filename) => {
      if (filename && (filename.includes('en-US.json') || filename.includes('package.json'))) {
        triggerHotReload(`官方资源变动 (${filename})`, true);
      }
    });
  }
}

switch (command) {
  case 'status':
    handleStatus();
    break;
  case 'check':
  case 'preflight':
    handlePreflight();
    break;
  case 'install':
  case 'patch':
    handleInstall();
    break;
  case 'restore':
  case 'uninstall':
    handleRestore();
    break;
  case 'drift':
  case 'scan':
    handleDrift();
    break;
  case 'launch':
  case 'start':
    handleLaunch();
    break;
  case 'watch':
  case 'daemon':
    handleWatch();
    break;
  case 'help':
  default:
    showHelp();
    break;
}
