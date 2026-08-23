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
    // 2. 赋予 Administrators 和 Users 完全控制权限
    execSync(`icacls "${targetDir}" /grant administrators:F /T /C /Q`, { stdio: 'ignore' });
    execSync(`icacls "${targetDir}" /grant *S-1-5-32-545:(OI)(CI)F /T /C /Q`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  canWriteDirectory,
  grantPermissions
};
