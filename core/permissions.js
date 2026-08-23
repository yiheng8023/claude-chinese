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
    // 2. 赋予 Administrators 和 Users / Everyone 完全控制权限
    execSync(`icacls "${targetDir}" /grant administrators:F /T /C /Q`, { stdio: 'ignore' });
    execSync(`icacls "${targetDir}" /grant *S-1-5-32-545:(OI)(CI)F /T /C /Q`, { stdio: 'ignore' });
    
    // 3. 对具体的 en-US.json 额外进行提权以防单文件锁死
    const enFile = path.join(targetDir, 'en-US.json');
    if (fs.existsSync(enFile)) {
      execSync(`takeown /F "${enFile}" /A`, { stdio: 'ignore' });
      execSync(`icacls "${enFile}" /grant administrators:F /Q`, { stdio: 'ignore' });
      execSync(`icacls "${enFile}" /grant *S-1-5-32-545:F /Q`, { stdio: 'ignore' });
    }
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  canWriteDirectory,
  grantPermissions
};
