const { execFileSync, spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function prepareCompanion(directory) {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('中文界面辅助目前面向 Windows x64。');
  }
  const framework = path.join(process.env.SystemRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319');
  const compiler = path.join(framework, 'csc.exe');
  if (!fs.existsSync(compiler)) throw new Error('找不到 Windows 自带的 .NET Framework 编译器。');
  const source = path.join(__dirname, 'Overlay.cs');
  const profile = JSON.stringify(require('./build-profile.cjs'));
  const fingerprint = createHash('sha256').update(fs.readFileSync(source)).update(profile).digest('hex');
  const buildRoot = directory ?? path.join(process.env.LOCALAPPDATA, 'claude-chinese', 'assist');
  const build = path.join(buildRoot, fingerprint.slice(0, 16));
  const executable = path.join(build, 'ClaudeChineseHints.exe');
  const profileName = 'inference-profile.json';
  const ready = () => fs.existsSync(executable) && fs.existsSync(path.join(build, profileName));
  if (ready()) return executable;

  fs.mkdirSync(buildRoot, { recursive: true });
  const staged = fs.mkdtempSync(path.join(buildRoot, '.build-'));
  try {
    fs.writeFileSync(path.join(staged, profileName), profile);
    execFileSync(compiler, [
      '/nologo', '/target:winexe', '/platform:x64', '/utf8output',
      `/out:${path.join(staged, path.basename(executable))}`,
      '/reference:System.Drawing.dll',
      '/reference:System.Windows.Forms.dll',
      '/reference:System.Web.Extensions.dll',
      ...['WindowsBase.dll', 'UIAutomationTypes.dll', 'UIAutomationClient.dll']
        .map(library => `/reference:${path.join(framework, 'WPF', library)}`),
      source
    ], { encoding: 'utf8', windowsHide: true });
    try { fs.renameSync(staged, build); }
    catch (error) { if (!ready()) throw error; }
  } finally {
    if (fs.existsSync(staged)) {
      for (const name of fs.readdirSync(staged)) fs.unlinkSync(path.join(staged, name));
      fs.rmdirSync(staged);
    }
  }
  return executable;
}

function startCompanion() {
  const executable = prepareCompanion();
  const child = spawn(executable, [], { detached: true, stdio: 'ignore', windowsHide: true });
  return new Promise((resolve, reject) => {
    const ready = setTimeout(() => {
      child.unref();
      resolve(true);
    }, 800);
    child.once('error', error => {
      clearTimeout(ready);
      reject(error);
    });
    child.once('exit', code => {
      clearTimeout(ready);
      if (code === 2) resolve(false);
      else reject(new Error(`辅助程序在初始化时退出（退出码 ${code}）。`));
    });
  });
}

async function runCommand() {
  try {
    const started = await startCompanion();
    console.log(started ? 'Claude 中文界面辅助已启动。暂停和退出在任务栏托盘。'
      : 'Claude 中文界面辅助已在运行。若要载入新版本，请先从托盘退出旧实例。');
  } catch (error) {
    console.error(`❌ 中文界面辅助启动失败: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) runCommand();
module.exports = { prepareCompanion, runCommand };
