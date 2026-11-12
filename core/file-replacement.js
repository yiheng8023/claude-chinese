const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function hashFile(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let size;
    while ((size = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, size));
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}

function flushFile(file) {
  const fd = fs.openSync(file, 'r+');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

/** Stage complete bytes on the destination volume, then replace the file. */
function replaceFile(source, destination) {
  const token = crypto.randomUUID();
  const temporary = path.join(path.dirname(destination), '.claude-cn-' + token + '.new');
  const previous = path.join(path.dirname(destination), '.claude-cn-' + token + '.old');
  const expected = hashFile(source);
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL);
    flushFile(temporary);
    if (hashFile(temporary) !== expected) throw new Error('临时文件完整性检查失败。');
    if (process.platform === 'win32') {
      // Preserve the target's DACL and retain a native backup if a rename fails.
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $PSHOME 'Modules'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
if([IO.File]::Exists($request.destination)){
  try { [IO.File]::Replace($request.source,$request.destination,$request.previous) }
  catch {
    if(-not [IO.File]::Exists($request.destination) -and [IO.File]::Exists($request.previous)){
      [IO.File]::Move($request.previous,$request.destination)
    }
    throw
  }
}else{ [IO.File]::Move($request.source,$request.destination) }
`], {
        input: JSON.stringify({source: temporary, destination, previous}),
        encoding: 'utf8', windowsHide: true, timeout: 30000, stdio: ['pipe','pipe','pipe']
      });
    } else {
      if (fs.existsSync(destination)) fs.chmodSync(temporary, fs.statSync(destination).mode);
      fs.renameSync(temporary, destination);
    }
    if (hashFile(destination) !== expected) throw new Error('替换后的完整性检查失败。');
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
  } catch (error) {
    const recovery = fs.existsSync(previous) ? `；原文件副本保留在 ${previous}` : '';
    throw new Error(`文件替换失败：${destination}。${error.message}${recovery}`);
  } finally {
    // Cleanup must not hide the replacement error or its recovery location.
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
  }
}

module.exports = { hashFile, flushFile, replaceFile };
