const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function createLaunchShortcut(output) {
  if (process.platform !== 'win32') throw new Error('快捷方式命令仅支持 Windows。');
  const destination = path.resolve(output);
  if (path.extname(destination).toLowerCase() !== '.lnk') throw new Error('快捷方式输出必须是 .lnk 文件。');
  if (!fs.existsSync(path.dirname(destination))) throw new Error('快捷方式输出目录不存在。');
  const root = path.resolve(__dirname, '..');
  const target = path.join(root, 'launch.bat');
  const script = `
$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($request.output)
$icon=$link.IconLocation
if(Test-Path -LiteralPath $request.output){
  $backup=$request.output+'.before-claude-chinese.bak'
  if(-not (Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $request.output -Destination $backup -ErrorAction Stop}
}
$link.TargetPath=$request.target
$link.Arguments=''
$link.WorkingDirectory=$request.root
$link.Description='Claude 中文启动器：检测待注册更新并按需重新汉化'
if($icon){$link.IconLocation=$icon}
$link.Save()
$saved=$shell.CreateShortcut($request.output)
if($saved.TargetPath -ne $request.target -or $saved.Arguments -ne ''){throw '快捷方式保存后校验失败。'}
@{output=$request.output;target=$saved.TargetPath;workingDirectory=$saved.WorkingDirectory} | ConvertTo-Json -Compress
`;
  return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    input: JSON.stringify({ output: destination, target, root }), encoding: 'utf8', windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  }));
}

module.exports = { createLaunchShortcut };
