/**
 * 权限管理与 Windows 最小特权 ACL 适配器
 * 支持 WindowsApps / TrustedInstaller 目录的 takeown 夺权与精准 ACL 授权
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function canWriteDirectory(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return false;
  try {
    const testFile = path.join(dirPath, `.perm_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.tmp`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
}

function resolveTargetDirs(targetDir) {
  const dirs = [targetDir];
  const base = path.basename(targetDir).toLowerCase();
  if (base === 'resources') {
    const parent = path.dirname(targetDir);
    if (fs.existsSync(path.join(parent, 'claude.exe')) || path.basename(parent).toLowerCase() === 'app') {
      dirs.unshift(parent);
    }
  } else if (fs.existsSync(path.join(targetDir, 'claude.exe')) && fs.existsSync(path.join(targetDir, 'resources'))) {
    dirs.push(path.join(targetDir, 'resources'));
  }
  return [...new Set(dirs)];
}

/**
 * 安全权限收敛：清除全局 Users 组 (*S-1-5-32-545) 的显式高危写入与完全控制权限，恢复受限只读继承
 */
function sanitizePermissions(targetDir) {
  if (process.platform !== 'win32' || !targetDir || !fs.existsSync(targetDir)) return;
  const targetDirs = resolveTargetDirs(targetDir);
  for (const dir of targetDirs) {
    try {
      execSync(`icacls "${dir}" /remove:g "*S-1-5-32-545" /t /c /q`, { stdio: 'ignore' });
    } catch (_) {}
  }
}

/**
 * 严格基于最小特权原则赋权：仅授予当前用户及管理员组写入权限，坚决杜绝全局 Users 组提权
 */
function grantPermissions(targetDir) {
  if (process.platform !== 'win32' || !targetDir || !fs.existsSync(targetDir)) return true;

  const targetDirs = resolveTargetDirs(targetDir);

  // 先行清理可能残留的高危 Users 组显式权限
  sanitizePermissions(targetDir);

  if (targetDirs.every(d => canWriteDirectory(d))) return true;

  const username = process.env.USERNAME;

  for (const dir of targetDirs) {
    // 1. 尝试当前进程直接夺权到 Administrators 组 (/a)
    try {
      execSync(`takeown /f "${dir}" /a /r /d y`, { stdio: 'ignore' });
    } catch (e) {
      try {
        execSync(`takeown /f "${dir}" /r /d y`, { stdio: 'ignore' });
      } catch (e2) {}
    }

    // 2. 赋予当前用户完全控制权限 (最小特权精准授权)
    if (username) {
      try {
        execSync(`icacls "${dir}" /grant:r "${username}":(OI)(CI)F /t /q /c`, { stdio: 'ignore' });
      } catch (e) {}
    }

    // 3. 赋予内置管理员组 (S-1-5-32-544) 完全控制权限
    try {
      execSync(`icacls "${dir}" /grant:r "*S-1-5-32-544":(OI)(CI)F /t /q /c`, { stdio: 'ignore' });
    } catch (e) {}
  }

  // 关键门禁：若当前进程已成功赋权（如管理员运行），立即返回，杜绝冗余弹窗
  if (targetDirs.every(d => canWriteDirectory(d))) return true;

  // 4. 若当前进程无管理员权限，通过原生临时脚本在后台静默触发 UAC 授权 (仅对当前用户和管理员组授权)
  const tmpScript = path.join(require('os').tmpdir(), `claude_perm_${Date.now()}.cmd`);
  try {
    let cmdContent = `@echo off\r\n`;
    for (const dir of targetDirs) {
      cmdContent +=
        `takeown /f "${dir}" /a /r /d y >nul 2>&1\r\n` +
        `takeown /f "${dir}" /r /d y >nul 2>&1\r\n` +
        `icacls "${dir}" /remove:g "*S-1-5-32-545" /t /c /q >nul 2>&1\r\n` +
        `icacls "${dir}" /grant:r "*S-1-5-32-544":(OI)(CI)F /t /c /q >nul 2>&1\r\n` +
        (username ? `icacls "${dir}" /grant:r "%USERNAME%":(OI)(CI)F /t /c /q >nul 2>&1\r\n` : '');
    }
    cmdContent += `del "%~f0" >nul 2>&1\r\n`;
    fs.writeFileSync(tmpScript, cmdContent, 'utf8');
    execSync(`powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c', '\\"${tmpScript}\\"' -WindowStyle Hidden -Verb RunAs -Wait"`, { stdio: 'ignore' });
  } catch (eUac) {
    // 忽略沙箱拦截或用户取消 UAC
  } finally {
    if (fs.existsSync(tmpScript)) {
      try { fs.unlinkSync(tmpScript); } catch (_) {}
    }
  }

  return targetDirs.every(d => canWriteDirectory(d));
}

module.exports = {
  canWriteDirectory,
  grantPermissions,
  sanitizePermissions,
  resolveTargetDirs
};
