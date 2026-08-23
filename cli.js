#!/usr/bin/env node

/**
 * claude-chinese 一体化命令行入口 (CLI)
 */
const { getClaudeInstallation } = require('./core/msix-detector');
const { applyPatch, restorePatch } = require('./core/patcher');
const { runDriftDetection } = require('./tools/drift-detector');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0] || 'status';

function showHelp() {
  console.log(`
Claude 桌面客户端轻量级自愈型中文汉化工具包 (claude-chinese)

用法:
  node cli.js [命令]

可用命令:
  status         检查 Claude 客户端安装与汉化补丁状态
  install        注入中文汉化补丁 (支持 MSIX / Win32 / macOS)
  restore        还原为官方英文原版
  drift          执行上游版本文本漂移分析 (Drift Detection)
  launch         自愈式启动 Claude (检测并自动补齐汉化后启动)
  help           显示此帮助信息
`);
}

function handleStatus() {
  console.log('=== Claude 客户端状态检查 ===\n');
  const info = getClaudeInstallation();

  if (!info.installPath) {
    console.log('❌ 未检测到已安装的 Claude 桌面客户端。');
    return;
  }

  console.log(`💻 操作系统: ${info.platform}`);
  console.log(`📦 安装类型: ${info.type.toUpperCase()}`);
  console.log(`🏷️ 客户端版本: ${info.version || '未知'}`);
  console.log(`📂 安装路径: ${info.installPath}`);
  console.log(`📁 资源路径: ${info.resourcesPath}`);

  if (info.isPatched) {
    console.log('\n🟢 汉化状态: 已汉化 (Patched - 中文界面就绪)');
  } else {
    console.log('\n🟡 汉化状态: 未汉化 / 原版英文 (Original)');
    console.log('💡 运行 "node cli.js install" 或双击 "install.bat" 即可一键汉化。');
  }
}

function handleInstall() {
  console.log('=== 开始安装 Claude 中文汉化补丁 ===\n');
  const result = applyPatch();

  if (result.success) {
    console.log('✅ 汉化补丁注入成功！');
    console.log(`📦 适配版本: ${result.info.version}`);
    console.log(`🇨🇳 已汉化词条数: ${result.info.entriesCount}`);
    console.log('\n🎉 请重启 Claude 桌面客户端查看中文界面。');
  } else {
    console.error(`❌ 汉化失败: ${result.error}`);
  }
}

function handleRestore() {
  console.log('=== 正在还原官方英文原版 ===\n');
  const result = restorePatch();

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
  const info = getClaudeInstallation();

  if (!info.isPatched) {
    console.log('⚡ 检测到汉化尚未挂载，正在执行静默自愈注入...');
    applyPatch();
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
  }
}

switch (command) {
  case 'status':
    handleStatus();
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
  case 'help':
  default:
    showHelp();
    break;
}
