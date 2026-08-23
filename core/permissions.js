/**
 * 权限管理与 Windows ACL 适配器
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function canWriteDirectory(dirPath) {
  try {
    const testFile = path.join(dirPath, `.perm_test_${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
}

function grantPermissions(targetDir) {
  if (process.platform !== 'win32') return true;

  try {
    // 1. 尝试使用 takeown 夺取管理员所有权
    execSync(`takeown /F "${targetDir}" /A /R /D Y`, { stdio: 'ignore' });
    // 2. 赋予管理员完全控制权限
    execSync(`icacls "${targetDir}" /grant administrators:F /T /C /Q`, { stdio: 'ignore' });
    // 3. 同时赋予当前用户写权限
    const username = process.env.USERNAME || 'Everyone';
    execSync(`icacls "${targetDir}" /grant "${username}":(OI)(CI)F /T /C /Q`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  canWriteDirectory,
  grantPermissions
};
