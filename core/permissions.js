/**
 * 权限管理与 Windows 最小特权 ACL 适配器
 * 遵循最小权限原则 (Least Privilege)，绝不对全局 Users 组赋予递归 Full Control。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function canWriteDirectory(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return false;
  try {
    const testFile = path.join(dirPath, `.perm_test_${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 针对当前用户授予最小必要修改权限 (仅授予当前用户 Modify 权限，绝不扩大至公共 Users 组)
 */
function grantPermissions(targetDir) {
  if (process.platform !== 'win32' || !targetDir || !fs.existsSync(targetDir)) return true;

  try {
    const username = process.env.USERNAME;
    if (username) {
      // 仅对当前运行用户赋予写入/修改权限 (M: Modify)，避免破坏系统原有安全边界
      execSync(`icacls "${targetDir}" /grant:r "${username}":(OI)(CI)M /Q`, { stdio: 'ignore' });
    }
    return canWriteDirectory(targetDir);
  } catch (e) {
    return false;
  }
}

module.exports = {
  canWriteDirectory,
  grantPermissions
};
