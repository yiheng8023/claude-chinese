/**
 * 终极全量汉化注入器：包含 JS 语言注册补丁 + Ion-Dist 语言包注入 + 动态模型特性
 */
const fs = require('fs');
const path = require('path');
const { getClaudeInstallation } = require('../core/msix-detector');
const { grantPermissions } = require('../core/permissions');

function runFullPatch() {
  const info = getClaudeInstallation();
  if (!info.installPath || !info.resourcesPath) {
    console.error('未找到 Claude 安装路径');
    return false;
  }

  const resDir = info.resourcesPath;
  const assetsDir = path.join(resDir, 'ion-dist', 'assets', 'v1');
  const i18nDir = path.join(resDir, 'ion-dist', 'i18n');
  const dynDir = path.join(i18nDir, 'dynamic');

  console.log('1. 获取目录写入权限...');
  grantPermissions(resDir);
  grantPermissions(path.join(resDir, 'ion-dist'));
  grantPermissions(assetsDir);
  grantPermissions(i18nDir);

  // 2. 补丁 JS 资源：注册 zh-CN 语言支持
  console.log('2. 正在注册前端 JS 语言支持列表...');
  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  const regexAdd = /((?:[\w$]+)=\["en-US"(?:,"[^"]+")+\])/g;

  let jsPatchedCount = 0;
  for (const file of jsFiles) {
    const fullPath = path.join(assetsDir, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    if (content.includes('"en-US"') && !content.includes('"zh-CN"')) {
      if (regexAdd.test(content)) {
        content = content.replace(regexAdd, (match) => {
          return match.slice(0, -1) + ',"zh-CN"]';
        });
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`  ✅ 成功在 ${file} 中注册 "zh-CN"`);
        jsPatchedCount++;
      }
    }
  }

  // 3. 安装 zh-CN.json 翻译文件
  console.log('3. 安装全量前端与外壳汉化语言包...');
  const shellZh = path.join(__dirname, '../dict/zh-CN.json');
  const ionZh = path.join(__dirname, '../dict/ion-zh-CN.json');
  const dynZh = path.join(__dirname, '../dict/dynamic-zh-CN.json');

  // Shell 层
  fs.copyFileSync(shellZh, path.join(resDir, 'zh-CN.json'));
  fs.copyFileSync(shellZh, path.join(resDir, 'en-US.json'));

  // Ion-Dist 层
  fs.copyFileSync(ionZh, path.join(i18nDir, 'zh-CN.json'));
  fs.copyFileSync(ionZh, path.join(i18nDir, 'en-US.json')); // 双保险
  fs.writeFileSync(path.join(i18nDir, 'zh-CN.overrides.json'), '{}\n', 'utf8');

  // Dynamic 层
  fs.copyFileSync(dynZh, path.join(dynDir, 'zh-CN.json'));
  fs.copyFileSync(dynZh, path.join(dynDir, 'en-US.json'));

  console.log('4. 写入补丁元数据...');
  fs.writeFileSync(path.join(resDir, '.claude_chinese_meta.json'), JSON.stringify({
    version: info.version,
    patchedAt: new Date().toISOString(),
    jsPatchedCount,
    fullDualLayer: true
  }, null, 2), 'utf8');

  console.log('✅ 全量汉化补丁与 JS 语言注册已 100% 成功注入！');
  return true;
}

if (require.main === module) {
  runFullPatch();
}

module.exports = {
  runFullPatch
};
