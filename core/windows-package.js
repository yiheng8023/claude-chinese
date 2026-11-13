const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const { assertReadableArchives, verifyIntegrity } = require('./asar-transaction');

function parsePackageName(name) {
  const match = /^(Claude|AnthropicPBC\.Claude)_(\d+\.\d+\.\d+\.\d+)_(x64|arm64)__([a-z0-9]{13})$/.exec(name);
  return match && { name: match[1], version: match[2].split('.').map(Number), architecture: match[3], family: `${match[1]}_${match[4]}` };
}

function compareVersions(a, b) {
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function selectPendingPackage(info, candidates) {
  const registered = parsePackageName(path.basename(info.installPath));
  if (!registered || registered.family !== info.packageFamilyName) return null;
  return candidates.filter(candidate => {
    const parsed = parsePackageName(candidate.packageFullName || '');
    return parsed && parsed.name === registered.name && parsed.family === registered.family &&
      parsed.architecture === registered.architecture && compareVersions(parsed.version, registered.version) > 0 &&
      candidate.version === parsed.version.join('.') && candidate.family === registered.family && candidate.signatureValid === true &&
      path.resolve(candidate.installPath || '') === path.join(path.dirname(path.resolve(info.installPath)), candidate.packageFullName);
  }).sort((a, b) => compareVersions(parsePackageName(b.packageFullName).version, parsePackageName(a.packageFullName).version))[0] || null;
}

function runPackageAction(request) {
  const script = request.action === 'repair' ? 'windows-official-repair.ps1' : 'windows-package.ps1';
  try { return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', fs.readFileSync(path.join(__dirname, script), 'utf8')], {
    input: JSON.stringify(request), encoding: 'utf8', windowsHide: true, timeout: request.action === 'repair' ? 600000 : 120000,
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim()); } catch (error) {
    throw new Error(`Windows ${request.action} 操作失败：${String(error.stderr || error.message).trim().slice(0, 1800)}`);
  }
}

/** Complete a verified, already-staged update only when the registered package cannot boot. */
function recoverPendingUpdate(info, options = {}) {
  if (info.platform !== 'win32' || info.type !== 'msix' || !info.resourcesPath) return info;
  let archiveError;
  try { assertReadableArchives(info.resourcesPath); return info; } catch (error) { archiveError = error; }
  const run = options.runPackageAction || runPackageAction;
  const registered = parsePackageName(path.basename(info.installPath));
  if (!registered) throw archiveError;
  const request = { name: registered.name, family: info.packageFamilyName };
  const candidates = run({ ...request, action: 'discover' });
  const candidate = selectPendingPackage(info, Array.isArray(candidates) ? candidates : []);
  if (!candidate) throw archiveError;
  if (fs.lstatSync(candidate.installPath).isSymbolicLink()) throw new Error('新版目录为链接，未执行自动恢复。');
  const resources = path.join(candidate.installPath, 'app', 'resources');
  for (const file of ['app.asar', 'ion-dist.asar']) {
    if (!fs.statSync(path.join(resources, file)).isFile()) throw new Error('待注册新版资源不完整。');
  }
  if (!fs.statSync(path.join(candidate.installPath, 'app', 'claude.exe')).isFile()) throw new Error('待注册新版缺少主程序。');
  assertReadableArchives(resources);
  verifyIntegrity(resources, path.join(candidate.installPath, 'app', 'claude.exe'));
  // The signed EXE anchors the headers; verify the payload hashes those headers contain too.
  let unpackedMismatch = false;
  for (const name of ['app.asar', 'ion-dist.asar']) {
    const archive = path.join(resources, name);
    for (const entry of asar.listPackage(archive)) {
      const relative = entry.replace(/^[/\\]/, '');
      const stat = asar.statFile(archive, relative, false);
      if (stat.files || stat.link) continue;
      if (stat.integrity?.algorithm !== 'SHA256' || !stat.integrity.hash) throw new Error('待注册新版缺少文件完整性记录。');
      if (crypto.createHash('sha256').update(asar.extractFile(archive, relative)).digest('hex') !== stat.integrity.hash) {
        // Authenticode signing after ASAR packaging changes some unpacked files.
        // Never waive their verification: install and compare a signed full MSIX instead.
        if (stat.unpacked) { unpackedMismatch = true; continue; }
        throw new Error(`待注册新版 ${name} 的内容校验失败。请使用官网完整安装包完成更新。`);
      }
    }
  }
  const isRunning = options.isRunning || require('./patcher').isClaudeRunning;
  if (isRunning()) throw new Error('待注册新版已找到，请先保存工作并退出 Claude，再运行启动器。');
  let repaired;
  if (unpackedMismatch) {
    if (registered.architecture !== 'x64') throw new Error('官方完整包自动恢复目前仅支持 Windows x64。');
    if (options.onProgress) options.onProgress('原生文件签名与旧 ASAR 哈希不一致，正在下载并校验官网完整安装包以恢复更新，请稍候。');
    repaired = run({ ...request, action: 'repair', registeredFullName: path.basename(info.installPath) });
    const parsed = parsePackageName(repaired?.packageFullName || '');
    if (!parsed || parsed.family !== info.packageFamilyName || parsed.architecture !== registered.architecture || compareVersions(parsed.version, registered.version) <= 0 ||
        path.resolve(repaired.installPath || '') !== path.join(path.dirname(path.resolve(info.installPath)), repaired.packageFullName)) throw new Error('官方完整包恢复后的身份不一致。');
    const { hashFile } = require('./file-replacement');
    const hashes = repaired.hashes;
    for (const required of ['app/claude.exe', 'app/resources/app.asar', 'app/resources/ion-dist.asar']) {
      if (!hashes || !Object.hasOwn(hashes, required)) throw new Error('官方完整包恢复缺少原始字节校验记录。');
    }
    for (const [relative, expected] of Object.entries(hashes)) {
      if (!/^app\/(claude\.exe|resources\/(app\.asar|ion-dist\.asar)(\.unpacked\/[^\\]+)?)$/.test(relative) || relative.split('/').some(p => p === '.' || p === '..') || !/^[a-f0-9]{64}$/.test(expected) || hashFile(path.join(repaired.installPath, relative)) !== expected) throw new Error('官方完整包恢复的实际文件校验失败。');
    }
    // A newer official hotfix can add or remove native files. Bind the inventory
    // to the verified repaired archives, not the superseded staged candidate.
    asar.uncacheAll();
    for (const name of ['app.asar', 'ion-dist.asar']) {
      const archive = path.join(repaired.installPath, 'app', 'resources', name);
      for (const entry of asar.listPackage(archive)) {
        const relative = entry.replace(/^[/\\]/, '');
        const stat = asar.statFile(archive, relative, false);
        if (stat.files || stat.link) continue;
        if (stat.unpacked && !Object.hasOwn(hashes, `app/resources/${name}.unpacked/${relative.replace(/\\/g, '/')}`)) throw new Error('官方完整包恢复缺少解包文件的原始字节校验记录。');
      }
    }
  } else run({ ...request, action: 'register', registeredFullName: path.basename(info.installPath), candidateFullName: candidate.packageFullName });
  const after = (options.getInstallation || require('./msix-detector').getClaudeInstallation)();
  if (after.packageFamilyName !== info.packageFamilyName || path.resolve(after.installPath || '') !== path.resolve(repaired ? repaired.installPath : candidate.installPath)) {
    throw new Error('新版注册后的安装路径不一致，未继续汉化或启动。');
  }
  assertReadableArchives(after.resourcesPath);
  verifyIntegrity(after.resourcesPath, path.join(path.dirname(after.resourcesPath), 'claude.exe'));
  return after;
}

module.exports = { parsePackageName, selectPendingPackage, recoverPendingUpdate, runPackageAction };
