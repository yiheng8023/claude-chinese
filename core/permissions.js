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

/**
 * 针对当前用户及管理员组授予修改与写入权限
 */
function grantPermissions(targetDir) {
  if (process.platform !== 'win32' || !targetDir || !fs.existsSync(targetDir)) return true;

  if (canWriteDirectory(targetDir)) return true;

  const username = process.env.USERNAME;

  // 1. 尝试当前进程直接夺权到 Administrators 组 (/a)
  try {
    execSync(`takeown /f "${targetDir}" /a /r /d y`, { stdio: 'ignore' });
  } catch (e) {
    try {
      execSync(`takeown /f "${targetDir}" /r /d y`, { stdio: 'ignore' });
    } catch (e2) {}
  }

  // 2. 赋予当前用户完全控制权限
  if (username) {
    try {
      execSync(`icacls "${targetDir}" /grant:r "${username}":(OI)(CI)F /t /q /c`, { stdio: 'ignore' });
    } catch (e) {}
  }

  // 3. 赋予内置管理员组 (S-1-5-32-544) 完全控制权限
  try {
    execSync(`icacls "${targetDir}" /grant:r "*S-1-5-32-544":(OI)(CI)F /t /q /c`, { stdio: 'ignore' });
  } catch (e) {}

  // 关键门禁：若当前进程已成功赋权（如管理员运行），立即返回，杜绝冗余弹窗
  if (canWriteDirectory(targetDir)) return true;

  // 4. 若当前进程无管理员权限，通过原生临时脚本在后台静默触发 UAC 授权 (Hidden 窗口绝不外露)
  try {
    const tmpScript = path.join(require('os').tmpdir(), `claude_perm_${Date.now()}.cmd`);
    const cmdContent = `@echo off\r\n` +
      `takeown /f "${targetDir}" /r /d y >nul 2>&1\r\n` +
      `icacls "${targetDir}" /grant:r "*S-1-5-32-545":(OI)(CI)F /t /c /q >nul 2>&1\r\n` +
      `icacls "${targetDir}" /grant:r "*S-1-5-32-544":(OI)(CI)F /t /c /q >nul 2>&1\r\n` +
      `if defined USERNAME icacls "${targetDir}" /grant:r "%USERNAME%":(OI)(CI)F /t /c /q >nul 2>&1\r\n` +
      `del "%~f0" >nul 2>&1\r\n`;
    fs.writeFileSync(tmpScript, cmdContent, 'utf8');
    execSync(`powershell -NoProfile -Command "Start-Process cmd -WindowStyle Hidden -Verb RunAs -Wait -ArgumentList '/c', '\"\"${tmpScript}\"\"'"`, { stdio: 'ignore' });
  } catch (eUac) {}

  return canWriteDirectory(targetDir);
}

module.exports = {
  canWriteDirectory,
  grantPermissions
};
