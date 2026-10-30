#!/usr/bin/env node

/**
 * claude-chinese 一体化命令行入口 (CLI)
 */
const { getClaudeInstallation } = require('./core/msix-detector');
const { applyPatch, restorePatch, isClaudeRunning, closeClaude } = require('./core/patcher');
const { runPreflightCheck } = require('./core/preflight');
const { runDriftDetection } = require('./tools/drift-detector');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0] || 'status';
if (args.includes('--path') && (!args[args.indexOf('--path') + 1] || args[args.indexOf('--path') + 1].startsWith('-'))) {
  console.error('❌ --path 需要一个有效的安装目录。');
  process.exit(2);
}

function confirmCloseClient(appName = 'Claude') {
  if (args.includes('--force') || args.includes('-f') || args.includes('-y') || args.includes('--yes')) {
    return true;
  }

  if (!process.stdin.isTTY) {
    console.error(`\n⚠️ 检测到 ${appName} 客户端当前正在运行！`);
    console.error(`为保护未保存的工作，安装器已安全暂停。请先手动退出客户端，或附加 --force 参数执行。`);
    return false;
  }

  console.log(`\n⚠️ 检测到 ${appName} 客户端当前正在运行！`);
  console.log(`为避免文件写入冲突并保护您正在进行的对话与未保存工作，请确认是否允许关闭客户端继续？`);
  process.stdout.write(`👉 输入 [y/N] 确认关闭并继续 (默认 N 取消): `);

  try {
    const buffer = Buffer.alloc(1024);
    const bytesRead = fs.readSync(0, buffer, 0, 1024, null);
    const answer = buffer.toString('utf8', 0, bytesRead).trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      return true;
    }
  } catch (e) {}

  return false;
}

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
  install        注入中文汉化补丁 (官网 Windows 安装 / 既有 macOS、Linux 散装布局)
  restore        还原为官方英文原版
  drift          执行上游版本文本漂移分析 (Drift Detection)
  launch         自愈式启动 Claude (检测并自动补齐汉化后启动)
  watch          启动热重载与自愈守护进程 (监听字典与版本变化)
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
    process.exitCode = 1;
  }
}

function handleStatus() {
  console.log('=== Claude 客户端状态检查 ===\n');
  const customPath = getCustomPath();
  const info = getClaudeInstallation(customPath);

  if (!info.installPath || !info.resourcesPath) {
    console.log(`❌ ${info.error || '未检测到已安装的 Claude 桌面客户端。'}`);
    process.exitCode = 1;
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
    if (info.needsUpdate) console.log('⚠️ 汉化工具或词库已更新，请退出客户端后重新安装汉化。');
  } else {
    console.log('\n🟡 汉化状态: 未汉化 / 原版英文 (Original)');
    if (info.patchStale) console.log('⚠️ 已有补丁记录与当前文件不符，可能被官方更新覆盖，需重新安装汉化。');
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
    process.exitCode = 1;
    return;
  }

  if (isClaudeRunning()) {
    const shouldClose = confirmCloseClient('Claude');
    if (!shouldClose) {
      console.log('\nℹ️ 已安全取消安装。请在保存工作并退出 Claude 客户端后重新执行。');
      process.exitCode = 1;
      return;
    }
    console.log('\n🔄 正在安全退出客户端以释放资源写入锁...');
    if (!closeClaude() || isClaudeRunning()) {
      console.error('❌ 客户端仍在运行，未执行安装。请保存工作后手动退出。');
      process.exitCode = 1;
      return;
    }
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
    process.exitCode = 1;
  }
}

function handleRestore() {
  console.log('=== 正在还原官方英文原版 ===\n');
  const customPath = getCustomPath();
  const installation = getClaudeInstallation(customPath);
  if (!installation.resourcesPath) {
    console.error(`❌ 还原失败: ${installation.error || '未找到客户端资源目录。'}`);
    process.exitCode = 1;
    return;
  }

  if (isClaudeRunning()) {
    const shouldClose = confirmCloseClient('Claude');
    if (!shouldClose) {
      console.log('\nℹ️ 已安全取消还原。请在保存工作并退出 Claude 客户端后重新执行。');
      process.exitCode = 1;
      return;
    }
    console.log('\n🔄 正在安全退出客户端以释放资源写入锁...');
    if (!closeClaude() || isClaudeRunning()) {
      console.error('❌ 客户端仍在运行，未执行还原。请保存工作后手动退出。');
      process.exitCode = 1;
      return;
    }
  }

  const result = restorePatch({ customPath });

  if (result.success) {
    console.log('✅ 还原成功！已恢复官方英文界面。');
  } else {
    console.error(`❌ 还原失败: ${result.error}`);
    process.exitCode = 1;
  }
}

function handleDrift() {
  console.log('=== 执行版本漂移检测 (Drift Scan) ===\n');
  const report = runDriftDetection(args[1] && !args[1].startsWith('-') ? args[1] : null, { customPath: getCustomPath() });
  console.log(`📊 官方词条总量: ${report.totalUpstreamKeys}`);
  console.log(`🇨🇳 词条收录率 (含保留英文术语): ${report.coverage} (${report.matchedKeysCount} / ${report.totalUpstreamKeys})`);
  console.log(`✨ 新增未汉化词条: ${report.newKeysCount}`);
  console.log(`🗑️ 废弃词条: ${report.staleKeysCount}`);
}

function handleLaunch() {
  const customPath = getCustomPath();
  const info = getClaudeInstallation(customPath);

  if (!info.isPatched || info.needsUpdate) {
    console.log('⚡ 检测到汉化尚未挂载，正在执行静默自愈注入...');
    if (isClaudeRunning()) {
      console.error('❌ 客户端正在运行，请先保存工作并退出，再运行自愈启动。');
      process.exitCode = 1;
      return;
    }
    const result = applyPatch({ customPath });
    if (!result.success) {
      console.error(`❌ 汉化失败，未继续启动: ${result.error}`);
      process.exitCode = 1;
      return;
    }
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
    process.exitCode = 1;
    return;
  }

  // 1. 初次静默自愈注入
  if (!info.isPatched || info.needsUpdate) {
    console.log('⚡ 检测到当前未安装汉化，正在执行初始热注入...');
    if (isClaudeRunning()) {
      console.error('❌ 客户端正在运行，请先保存工作并退出，再启动监听。');
      process.exitCode = 1;
      return;
    }
    const result = applyPatch({ customPath, autoClose: false });
    if (!result.success) {
      console.error(`❌ 初始汉化失败: ${result.error}`);
      process.exitCode = 1;
      return;
    }
    console.log('✅ 初始汉化挂载完成！\n');
  }

  console.log(`📁 监听项目词库: ${path.join(__dirname, 'dict')}`);
  console.log(`📁 监听客户端资源: ${info.resourcesPath}`);
  console.log('💡 守护特性已激活:');
  console.log('   1. 监听词库与当前资源目录；客户端运行时仅提示，不强制退出。');
  console.log('   2. ASAR 更新后请重启；官方安装路径换版后，请重新运行 launch 或 watch。\n');
  console.log('👀 守护进程运行中 (按 Ctrl+C 退出)...');

  let debounceTimer = null;
  let stabilityCheckTimer = null;

  const triggerHotReload = (reason, isUpstreamChange = false) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (stabilityCheckTimer) clearTimeout(stabilityCheckTimer);

    // 对于本地词典变更，300ms 快速响应；对于上游更新，增加 800ms 静稳窗口以防写入冲突
    const delay = isUpstreamChange ? 800 : 300;

    debounceTimer = setTimeout(() => {
      // 官方更新场景：多轮连续静稳窗口检测 (连续 3 次检查，每次间隔 600ms，要求至少 1.8 秒全静默)
      if (isUpstreamChange && info.resourcesPath) {
        let stableRounds = 0;
        const requiredRounds = 3;
        let lastSnapshot = '';

        const getSnapshot = () => {
          let snap = '';
          const targets = [
            path.join(info.resourcesPath, 'en-US.json'),
            path.join(info.resourcesPath, 'ion-dist', 'i18n', 'en-US.json'),
            path.join(info.resourcesPath, 'package.json'),
            path.join(info.resourcesPath, 'ion-dist.asar'),
            path.join(info.resourcesPath, 'app.asar')
          ];
          for (const t of targets) {
            try {
              if (fs.existsSync(t)) {
                const s = fs.statSync(t);
                snap += `${t}:${s.size}:${s.mtimeMs};`;
              }
            } catch (e) {}
          }
          return snap;
        };

        lastSnapshot = getSnapshot();

        const checkStability = () => {
          stabilityCheckTimer = setTimeout(() => {
            const currentSnapshot = getSnapshot();
            if (currentSnapshot !== lastSnapshot) {
              lastSnapshot = currentSnapshot;
              stableRounds = 0;
              console.log('⏳ 官方更新器仍在写入文件，持续监测静稳窗口...');
              checkStability();
            } else {
              stableRounds++;
              if (stableRounds < requiredRounds) {
                checkStability();
              } else {
                executePatch(reason);
              }
            }
          }, 600);
        };

        checkStability();
      } else {
        executePatch(reason);
      }
    }, delay);
  };

  const executePatch = (reason) => {
    const current = getClaudeInstallation(customPath);
    if (current.isPatched && !current.needsUpdate) return;
    if (isClaudeRunning()) {
      console.warn('⚠️ 检测到更新，但客户端仍在运行；请退出后运行 install 或 launch，未强制关闭客户端。');
      return;
    }
    console.log(`\n🔔 [${new Date().toLocaleTimeString()}] 检测到变动: ${reason}`);
    console.log('⚡ 正在执行增量热重载与自愈注入...');
    try {
      const result = applyPatch({ customPath, autoClose: false });
      if (result.success) {
        console.log(result.nativeSupported ? result.message : `🎉 汉化更新完成 (已挂载 ${result.info.entriesCount} 词条)，请重新启动 Claude。`);
      } else console.error(`❌ 汉化更新失败: ${result.error}`);
    } catch (err) {
      console.error('⚠️ 热重载同步异常:', err.message);
    }
  };

  // 监听本地 dict 目录变更 (词典热更新，内置跨平台/版本降级保护)
  const dictDir = path.join(__dirname, 'dict');
  if (fs.existsSync(dictDir)) {
    try {
      fs.watch(dictDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          triggerHotReload(`本地词库更新 (${filename})`, false);
        }
      });
    } catch (e) {
      // Linux 下 Node < 19.1 不支持 recursive 时的优雅降级
      try {
        fs.readdirSync(dictDir).forEach(f => {
          const filePath = path.join(dictDir, f);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && f.endsWith('.json')) {
            fs.watch(filePath, () => triggerHotReload(`本地词库更新 (${f})`, false));
          }
        });
      } catch (err) {}
    }
  }

  // 监听客户端 resources 目录变更 (官方升级自愈，支持 recursive 与全子目录深度监听)
  const resDir = info.resourcesPath;
  if (fs.existsSync(resDir)) {
    const handleUpstreamChange = (filename) => {
      if (!filename) return;
      // 忽略我们自己的物理备份与元数据，防止自循环触发
      if (filename.endsWith('.orig.bak') || filename.endsWith('.claude_chinese_meta.json') || filename.includes('zh-CN')) return;
      if (filename.endsWith('.json') || filename.endsWith('.js') || filename.endsWith('.asar')) {
        triggerHotReload(`官方资源变动 (${filename})`, true);
      }
    };

    try {
      fs.watch(resDir, { recursive: true }, (eventType, filename) => {
        handleUpstreamChange(filename);
      });
    } catch (e) {
      // 跨平台降级：针对不支持 recursive 的系统，主动遍历子目录建立监听
      const subDirs = [
        resDir,
        path.join(resDir, 'ion-dist'),
        path.join(resDir, 'ion-dist', 'i18n'),
        path.join(resDir, 'ion-dist', 'assets', 'v1')
      ];
      for (const d of subDirs) {
        if (fs.existsSync(d)) {
          try {
            fs.watch(d, (eventType, filename) => {
              handleUpstreamChange(filename);
            });
          } catch (err) {}
        }
      }
    }
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
