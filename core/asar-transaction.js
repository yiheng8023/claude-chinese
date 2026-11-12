const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const { hashFile, flushFile, replaceFile } = require('./file-replacement');

function transactionPointer(resources) {
  return path.join(resources, '.claude_chinese_transaction.json');
}

function assertNoPendingTransaction(resources) {
  const pointer = transactionPointer(resources);
  if (fs.existsSync(pointer)) throw new Error(`发现未完成的汉化事务。请先检查 ${pointer} 中的恢复记录，原版备份已保留。`);
}

function saveRecovery(resources, work, snapshots) {
  for (const item of snapshots) {
    if (item.present) {
      flushFile(item.backup);
      item.hash = hashFile(item.backup);
    }
  }
  const record = path.join(work, 'recovery.json');
  fs.writeFileSync(record, JSON.stringify({ resources, snapshots }, null, 2), { flag: 'wx' });
  flushFile(record);
  const pointer = transactionPointer(resources);
  fs.writeFileSync(pointer, JSON.stringify({ work, record }, null, 2), { flag: 'wx' });
  flushFile(pointer);
}

function clearRecovery(resources, work) {
  const pointer = transactionPointer(resources);
  if (JSON.parse(fs.readFileSync(pointer, 'utf8')).work !== work) throw new Error('事务恢复记录已变化，已保留现场。');
  fs.unlinkSync(pointer);
}

function rollbackSnapshots(snapshots) {
  const failures = [];
  for (const item of [...snapshots].reverse()) {
    try {
      if (item.present) {
        if (fs.existsSync(item.file) && hashFile(item.file) === item.hash) continue;
        replaceFile(item.backup, item.file);
        if (hashFile(item.file) !== item.hash) throw new Error('恢复哈希不符');
      } else if (fs.existsSync(item.file)) fs.unlinkSync(item.file);
    } catch { failures.push(item.file); }
  }
  return failures;
}

function headerHash(file) {
  asar.uncacheAll();
  return crypto.createHash('sha256').update(asar.getRawHeader(file).headerString).digest('hex');
}

function integrityRecords(exe) {
  const text = fs.readFileSync(exe).toString('latin1');
  const records = {};
  for (const match of text.matchAll(/\{"file":"([^"\r\n]+\.asar)","alg":"SHA256","value":"([a-fA-F0-9]{64})"\}/g)) {
    const name = match[1].split(/[\\/]/).pop();
    if (records[name] && records[name] !== match[2].toLowerCase()) throw new Error(`重复且冲突的完整性记录: ${name}`);
    records[name] = match[2].toLowerCase();
  }
  return records;
}

function verifyIntegrity(resources, exe) {
  if (!fs.existsSync(exe)) return;
  const records = integrityRecords(exe);
  for (const name of ['ion-dist.asar', 'app.asar']) {
    const file = path.join(resources, name);
    if (fs.existsSync(file) && records[name] !== headerHash(file)) {
      throw new Error(`${name} 与主程序完整性记录不一致，已停止写入。`);
    }
  }
}

function artifactPaths(resources) {
  return [
    ['ion-dist.asar', path.join(resources, 'ion-dist.asar')],
    ['app.asar', path.join(resources, 'app.asar')],
    ['claude.exe', path.join(path.dirname(resources), 'claude.exe')]
  ].filter(([, file]) => fs.existsSync(file));
}

function assertReadableArchives(resources) {
  asar.uncacheAll();
  for (const name of ['app.asar', 'ion-dist.asar']) {
    const file = path.join(resources, name);
    if (!fs.existsSync(file)) continue;
    const size = fs.statSync(file).size;
    try {
      if (size < 8) throw new Error('truncated header');
      asar.getRawHeader(file);
    } catch {
      throw new Error(`客户端资源 ${name} 已损坏（${size === 0 ? '0 字节' : '归档头不可读'}）。请使用官网完整安装包修复客户端后重新汉化；现有原版备份已保留。`);
    }
  }
}

function readMeta(resources) {
  const file = path.join(resources, '.claude_chinese_meta.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasChineseCatalog(archive) {
  asar.uncacheAll();
  return asar.listPackage(archive).some(file => file.replace(/\\/g, '/') === '/i18n/zh-CN.json');
}

function baselineArtifacts(resources, meta) {
  assertReadableArchives(resources);
  const artifacts = artifactPaths(resources);
  if (meta.archives && Object.keys(meta.archives).some(name => !artifacts.some(([key]) => key === name))) {
    throw new Error('补丁清单中的客户端文件缺失或名称无效，原版备份已保留。');
  }
  const states = artifacts.map(([name, file]) => ({ name, file, hash: hashFile(file), record: meta.archives?.[name] }));
  const matched = states.filter(s => s.record && s.hash === s.record.patchedHash);
  let useBackups = false;
  if (matched.length) {
    if (matched.length !== states.length) throw new Error('客户端文件已被部分更新或更改，不能混用旧备份。请先恢复完整官方安装。');
    useBackups = true;
  } else if (!meta.archives && meta.mode === 'asar_repack' && hasChineseCatalog(path.join(resources, 'ion-dist.asar'))) {
    // Migrate a coherent installation produced by older toolkit versions.
    useBackups = true;
  } else {
    if (!meta.mode && hasChineseCatalog(path.join(resources, 'ion-dist.asar'))) {
      throw new Error('中文资源缺少可确认来源的补丁记录，不能覆盖或删除现有备份。');
    }
    if (meta.archives && hasChineseCatalog(path.join(resources, 'ion-dist.asar'))) {
      throw new Error('当前文件包含中文资源但不匹配已记录的补丁，不能将未知修改作为原版备份。');
    }
    // An official update supersedes old backups. Never install from those backups.
    verifyIntegrity(resources, path.join(path.dirname(resources), 'claude.exe'));
  }
  return states.map(s => {
    const source = useBackups ? s.file + '.orig.bak' : s.file;
    if (!fs.existsSync(source)) throw new Error(`缺少可恢复的原版备份: ${s.name}`);
    if (useBackups && s.record && hashFile(source) !== s.record.originalHash) throw new Error(`原版备份校验失败: ${s.name}`);
    return { ...s, source, sourceHash: hashFile(source) };
  });
}

/** Stage the complete EXE/ASAR set; rollback all writes if any replacement fails. */
function applyAsarTransaction(info, options, applyStaged) {
  const resources = info.resourcesPath;
  try { assertNoPendingTransaction(resources); } catch (error) { return { success:false, error:error.message }; }
  const metaPath = path.join(resources, '.claude_chinese_meta.json');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-cn-transaction-'));
  const stage = path.join(work, 'app');
  const stageRes = path.join(stage, 'resources');
  const undo = path.join(work, 'rollback');
  const snapshots = [];
  let keepRecovery = false;
  const snapshot = file => {
    const backup = path.join(undo, String(snapshots.length));
    const present = fs.existsSync(file);
    if (present) fs.copyFileSync(file, backup);
    snapshots.push({ file, backup, present });
  };
  try {
    const metaBefore = fs.existsSync(metaPath) ? hashFile(metaPath) : null;
    const artifacts = baselineArtifacts(resources, readMeta(resources));
    fs.mkdirSync(stageRes, { recursive: true });
    fs.mkdirSync(undo);
    for (const item of artifacts) {
      const dest = item.name === 'claude.exe' ? path.join(stage, item.name) : path.join(stageRes, item.name);
      fs.copyFileSync(item.source, dest);
      const unpacked = item.file + '.unpacked';
      if (fs.existsSync(unpacked)) fs.cpSync(unpacked, dest + '.unpacked', { recursive: true });
    }
    verifyIntegrity(stageRes, path.join(stage, 'claude.exe'));
    const result = applyStaged({ ...options, customPath: stage, autoClose: false });
    if (!result.success) return result;
    verifyIntegrity(stageRes, path.join(stage, 'claude.exe'));
    const meta = readMeta(stageRes);
    meta.version = info.version;
    meta.type = info.type;
    meta.archives = {};
    for (const item of artifacts) {
      const staged = item.name === 'claude.exe' ? path.join(stage, item.name) : path.join(stageRes, item.name);
      meta.archives[item.name] = { originalHash: item.sourceHash, patchedHash: hashFile(staged) };
    }
    fs.writeFileSync(path.join(stageRes, '.claude_chinese_meta.json'), JSON.stringify(meta, null, 2));

    // Check for an upstream update or another writer while staging was in progress.
    for (const item of artifacts) {
      if (hashFile(item.file) !== item.hash || hashFile(item.source) !== item.sourceHash) throw new Error('准备期间客户端文件或备份发生变化，已取消安装，请重新运行。');
      snapshot(item.file);
      snapshot(item.file + '.orig.bak');
    }
    if ((fs.existsSync(metaPath) ? hashFile(metaPath) : null) !== metaBefore) throw new Error('准备期间补丁记录发生变化，已取消安装。');
    snapshot(metaPath);
    keepRecovery = true;
    saveRecovery(resources, work, snapshots);
    try {
      for (const item of artifacts) {
        if (item.source !== item.file + '.orig.bak') replaceFile(item.source, item.file + '.orig.bak');
      }
      for (const item of artifacts) {
        const staged = item.name === 'claude.exe' ? path.join(stage, item.name) : path.join(stageRes, item.name);
        replaceFile(staged, item.file);
      }
      replaceFile(path.join(stageRes, '.claude_chinese_meta.json'), metaPath);
      for (const item of artifacts) {
        if (hashFile(item.file) !== meta.archives[item.name].patchedHash) throw new Error(`写入校验失败: ${item.name}`);
      }
      verifyIntegrity(resources, path.join(path.dirname(resources), 'claude.exe'));
      clearRecovery(resources, work);
      keepRecovery = false;
    } catch (error) {
      const failures = rollbackSnapshots(snapshots);
      asar.uncacheAll();
      if (failures.length) {
        keepRecovery = true;
        throw new Error(`${error.message}；部分文件未能回滚，恢复副本保留在 ${work}`);
      }
      clearRecovery(resources, work);
      keepRecovery = false;
      throw new Error(`${error.message}；已恢复安装前文件。`);
    }
    asar.uncacheAll();
    result.info = { ...result.info, version: info.version, type: info.type, resourcesPath: resources };
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (!keepRecovery) fs.rmSync(work, { recursive: true, force: true });
  }
}

function restoreAsarTransaction(info) {
  const resources = info.resourcesPath;
  try { assertNoPendingTransaction(resources); } catch (error) { return { success:false, error:error.message }; }
  const metaPath = path.join(resources, '.claude_chinese_meta.json');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-cn-restore-'));
  const snapshots = [];
  let keepRecovery = false;
  try {
    const metaBefore = fs.existsSync(metaPath) ? hashFile(metaPath) : null;
    const meta = readMeta(resources);
    const artifacts = baselineArtifacts(resources, meta);
    const baselineRes = path.join(work, 'baseline', 'resources');
    fs.mkdirSync(baselineRes, { recursive: true });
    for (const item of artifacts) {
      const dest = item.name === 'claude.exe' ? path.join(work, 'baseline', item.name) : path.join(baselineRes, item.name);
      fs.copyFileSync(item.source, dest);
    }
    verifyIntegrity(baselineRes, path.join(work, 'baseline', 'claude.exe'));
    for (const file of [...artifacts.flatMap(a => [a.file, a.file + '.orig.bak']), metaPath]) {
      const present = fs.existsSync(file);
      const backup = path.join(work, `snapshot-${snapshots.length}`);
      if (present) fs.copyFileSync(file, backup);
      snapshots.push({ file, present, backup });
    }
    for (const item of artifacts) {
      if (hashFile(item.file) !== item.hash || hashFile(item.source) !== item.sourceHash) throw new Error('还原准备期间客户端文件发生变化，已取消还原。');
    }
    if ((fs.existsSync(metaPath) ? hashFile(metaPath) : null) !== metaBefore) throw new Error('还原准备期间补丁记录发生变化，已取消还原。');
    keepRecovery = true;
    saveRecovery(resources, work, snapshots);
    try {
      for (const item of artifacts) {
        if (item.source !== item.file) replaceFile(item.source, item.file);
        if (hashFile(item.file) !== item.sourceHash) throw new Error(`还原后的完整文件哈希不符：${item.name}`);
      }
      verifyIntegrity(resources, path.join(path.dirname(resources), 'claude.exe'));
      for (const item of artifacts) {
        const backup = item.file + '.orig.bak';
        if (fs.existsSync(backup)) fs.unlinkSync(backup);
      }
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      clearRecovery(resources, work);
      keepRecovery = false;
    } catch (error) {
      const failures = rollbackSnapshots(snapshots);
      if (failures.length) {
        keepRecovery = true;
        throw new Error(`${error.message}；部分文件未能回滚，恢复副本保留在 ${work}`);
      }
      clearRecovery(resources, work);
      keepRecovery = false;
      throw new Error(`${error.message}；已恢复还原前文件。`);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    asar.uncacheAll();
    if (!keepRecovery) fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = { hashFile, integrityRecords, verifyIntegrity, artifactPaths, assertReadableArchives, readMeta, baselineArtifacts, applyAsarTransaction, restoreAsarTransaction };
