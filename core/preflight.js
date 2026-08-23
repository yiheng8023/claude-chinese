/**
 * 前置环境全维预检引擎 (Pre-flight Health Check)
 * 包含 Node.js 弹性最低版本判定 (>= 16.0.0 绝不锁死高版本)、客户端安装探测、进程文件锁占用与目录读写权限全维断言。
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('./msix-detector');
const { isClaudeRunning, closeClaude } = require('./patcher');
const { canWriteDirectory } = require('./permissions');

const MIN_NODE_VERSION = 16;

function runPreflightCheck(options = {}) {
  const checks = [];
  let allPassed = true;

  // 1. Node.js 运行时最低版本检测 (支持所有更高版本，绝不限制上限)
  const nodeVerStr = process.version.replace(/^v/, '');
  const majorVer = parseInt(nodeVerStr.split('.')[0], 10);
  const nodePassed = !isNaN(majorVer) && majorVer >= MIN_NODE_VERSION;
  checks.push({
    id: 'node-runtime',
    name: 'Node.js 运行时版本',
    detail: `当前: v${nodeVerStr} (要求: >= v${MIN_NODE_VERSION}.0.0)`,
    passed: nodePassed,
    critical: true
  });
  if (!nodePassed) allPassed = false;

  // 2. 客户端安装与资源路径自动探测
  const info = getClaudeInstallation(options.customPath);
  const installPassed = !!(info.installPath && info.resourcesPath);
  checks.push({
    id: 'client-installation',
    name: 'Claude 客户端安装状态',
    detail: installPassed ? `${info.type.toUpperCase()} 安装 (版本: ${info.version || '未知'})` : '未检测到客户端安装路径',
    passed: installPassed,
    critical: true
  });
  if (!installPassed) allPassed = false;

  // 3. 运行中进程占用与文件锁释放探测
  const isRunning = isClaudeRunning();
  let processDetail = '已就绪 (未运行，无文件锁占用)';
  if (isRunning) {
    if (options.autoClose !== false) {
      const closed = closeClaude();
      processDetail = closed ? '已就绪 (检测到正在运行，已自动退出释放文件占用)' : '正在运行 (请手动退出客户端)';
    } else {
      processDetail = '运行中 (建议退出客户端以避免文件锁冲突)';
    }
  }
  checks.push({
    id: 'process-locking',
    name: '进程占用与文件锁状态',
    detail: processDetail,
    passed: true,
    critical: false
  });

  // 4. 目录写权限探测
  let writePassed = false;
  if (installPassed) {
    writePassed = canWriteDirectory(info.resourcesPath);
  }
  checks.push({
    id: 'filesystem-permissions',
    name: '资源目录读写权限',
    detail: writePassed ? '正常 (直接可写)' : '受限 (安装器将自动申请提权)',
    passed: true,
    critical: false
  });

  return {
    allPassed,
    info,
    checks
  };
}

module.exports = {
  MIN_NODE_VERSION,
  runPreflightCheck
};
