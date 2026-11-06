const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const asar = require('@electron/asar');
const { recoverPendingUpdate, selectPendingPackage } = require('../core/windows-package');
const { withLaunchLock } = require('../core/launch-lock');

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pending-registration-'));
  try {
    const lock = path.join(root,'launch.lock');
    withLaunchLock(()=>{
      const contender = spawnSync(process.execPath,['-e',`require(${JSON.stringify(require.resolve('../core/launch-lock'))}).withLaunchLock(()=>{throw Error('must not enter')},${JSON.stringify(lock)});`],{encoding:'utf8'});
      assert.notEqual(contender.status,0);
      assert.match(contender.stderr,/启动锁已存在/);
      assert.doesNotMatch(contender.stderr,/Error: must not enter/);
    },lock);
    assert(!fs.existsSync(lock),'Normal launch releases the lock');
    assert.throws(()=>withLaunchLock(()=>{throw Error('launch error')},lock),/launch error/);
    assert(!fs.existsSync(lock),'A failed launch releases its own lock');
    fs.mkdirSync(lock);
    assert.throws(()=>withLaunchLock(()=>assert.fail('Do not reclaim an unknown or stale lock automatically'),lock),/启动锁已存在/);
    fs.rmdirSync(lock);
    const oldRoot = path.join(root, 'Claude_4.16336.0.0_x64__pzs8sxrjxfjjc');
    const newRoot = path.join(root, 'Claude_4.23118.0.0_x64__pzs8sxrjxfjjc');
    const oldRes = path.join(oldRoot, 'app', 'resources');
    const newRes = path.join(newRoot, 'app', 'resources');
    fs.mkdirSync(oldRes, { recursive: true });
    fs.mkdirSync(newRes, { recursive: true });
    fs.writeFileSync(path.join(oldRes, 'app.asar'), '');
    fs.writeFileSync(path.join(oldRes, 'ion-dist.asar'), '');
    fs.writeFileSync(path.join(oldRes, 'app.asar.orig.bak'), 'original backup');
    const source = path.join(root, 'source');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'index.js'), 'module.exports = 42;');
    for (const file of ['app.asar', 'ion-dist.asar']) await asar.createPackage(source, path.join(newRes, file));
    const records = ['app.asar', 'ion-dist.asar'].map(file => ({file,alg:'SHA256',value:crypto.createHash('sha256').update(asar.getRawHeader(path.join(newRes,file)).headerString).digest('hex')}));
    fs.writeFileSync(path.join(newRoot, 'app', 'claude.exe'), records.map(record => JSON.stringify(record)).join('\n'));
    const oldInfo = { platform:'win32', type:'msix', installPath:oldRoot, resourcesPath:oldRes, packageFamilyName:'Claude_pzs8sxrjxfjjc' };
    const newInfo = { ...oldInfo, installPath:newRoot, resourcesPath:newRes };
    const candidate = { packageFullName:path.basename(newRoot), version:'4.23118.0.0', installPath:newRoot, family:oldInfo.packageFamilyName, signatureValid:true };
    const actions = [];
    const options = { isRunning:()=>false, getInstallation:()=>newInfo, runPackageAction:request=>{
      actions.push(request.action);
      return request.action==='discover' ? [candidate] : {registered:true};
    }};
    assert.equal(recoverPendingUpdate(oldInfo,options),newInfo);
    assert.deepEqual(actions,['discover','register']);
    assert.equal(fs.readFileSync(path.join(oldRes,'app.asar.orig.bak'),'utf8'),'original backup');
    assert.equal(fs.statSync(path.join(oldRes,'app.asar')).size,0,'Do not repair the superseded package with stale backups');
    assert.equal(recoverPendingUpdate(newInfo,{runPackageAction:()=>assert.fail('Healthy startup must not query or register packages')}),newInfo);
    for (const changes of [
      {signatureValid:false}, {family:'AnthropicPBC.Claude_fnn82j28hfe8t'}, {version:'4.99999.0.0'},
      {installPath:path.join(root,'elsewhere')}, {packageFullName:'../'+candidate.packageFullName},
      {packageFullName:'Claude_4.16335.0.0_x64__pzs8sxrjxfjjc',version:'4.16335.0.0'}
    ]) assert.equal(selectPendingPackage(oldInfo,[{...candidate,...changes}]),null);
    assert.throws(()=>recoverPendingUpdate(oldInfo,{...options,isRunning:()=>true}),/保存工作并退出/);
    assert.throws(()=>recoverPendingUpdate(oldInfo,{...options,runPackageAction:()=>[]}),/0 字节/);
    assert.throws(()=>recoverPendingUpdate(oldInfo,{...options,getInstallation:()=>oldInfo}),/安装路径不一致/);
    const intact = fs.readFileSync(path.join(newRes,'ion-dist.asar'));
    const altered = Buffer.from(intact);
    altered[altered.length-1] ^= 1;
    fs.writeFileSync(path.join(newRes,'ion-dist.asar'),altered);
    assert.throws(()=>recoverPendingUpdate(oldInfo,{...options,runPackageAction:request=>{
      assert.notEqual(request.action,'register','A signed header does not prove unchanged payload bytes');
      return [candidate];
    }}),/内容校验失败/);
    fs.writeFileSync(path.join(newRes,'ion-dist.asar'),intact);
    fs.writeFileSync(path.join(newRes,'ion-dist.asar'),'');
    assert.throws(()=>recoverPendingUpdate(oldInfo,{...options,runPackageAction:request=>{
      assert.notEqual(request.action,'register','Reject a damaged candidate before any registration');
      return [candidate];
    }}),/0 字节/);

    if(process.platform==='win32') {
      const nativeSource = process.argv[2] || path.join(__dirname,'../core/windows-package.ps1');
      const parse = spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
        '$tokens=$null; $parseErrors=$null; $source=Get-Content -LiteralPath ([Console]::In.ReadToEnd()) -Raw -Encoding UTF8; [System.Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$parseErrors)|Out-Null; if($parseErrors.Count){throw ($parseErrors|Out-String)}'],
      {input:nativeSource,encoding:'utf8',windowsHide:true});
      assert.equal(parse.status,0,parse.stderr);
      const incomplete = path.join(root,'Claude_4.30000.0.0_x64__pzs8sxrjxfjjc');
      fs.mkdirSync(incomplete);
      for (const [directory,version] of [[oldRoot,'4.16336.0.0'],[newRoot,'4.23118.0.0']]) {
        fs.writeFileSync(path.join(directory,'AppxManifest.xml'),`<Package><Identity Name="Claude" Publisher="CN=Fixture" Version="${version}"/></Package>`);
      }
      const nativeStubs = `
$script:packageQueries=0
function Get-AppxPackage {
  $script:packageQueries++
  if($request.fixtureRegisteredAfter -and $script:packageQueries -gt 1){$request.fixtureRegisteredAfter}else{$request.fixtureRegistered}
}
function Get-AuthenticodeSignature { [pscustomobject]@{Status='Valid';SignerCertificate=[pscustomobject]@{Subject='CN=Fixture'}} }
function Add-AppxPackage { throw 'Live registration is forbidden in this test' }
function Get-WinEvent {
  foreach($item in $request.fixtureEvents) {
    $event=[pscustomobject]@{Xml=('<Event><EventData><Data Name="PackageMoniker">'+$item.old+'</Data><Data Name="PackageMoniker2">'+$item.new+'</Data></EventData></Event>')}
    $event | Add-Member -MemberType ScriptMethod -Name ToXml -Value {$this.Xml}
    $event
  }
}
`;
      const discovery = spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',nativeStubs+fs.readFileSync(nativeSource,'utf8')],{
        input:JSON.stringify({action:'discover',name:'Claude',family:oldInfo.packageFamilyName,
          fixtureRegistered:{Name:'Claude',Version:'4.16336.0.0',PackageFamilyName:oldInfo.packageFamilyName,PackageFullName:path.basename(oldRoot),InstallLocation:oldRoot},
          fixtureEvents:[{old:path.basename(oldRoot),new:path.basename(incomplete)},{old:path.basename(oldRoot),new:path.basename(newRoot)}]}),
        encoding:'utf8',windowsHide:true
      });
      assert.equal(discovery.status,0,'A stale candidate must not abort native discovery: '+discovery.stderr);
      const found=JSON.parse(discovery.stdout);
      assert.deepEqual(found.map(item=>item.packageFullName),[candidate.packageFullName]);
      const registeredOld={Name:'Claude',Version:'4.16336.0.0',PackageFamilyName:oldInfo.packageFamilyName,PackageFullName:path.basename(oldRoot),InstallLocation:oldRoot};
      const registeredNew={...registeredOld,Version:'4.23118.0.0',PackageFullName:candidate.packageFullName,InstallLocation:newRoot};
      for(const situation of [{fixtureRegistered:registeredNew},{fixtureRegistered:registeredOld,fixtureRegisteredAfter:registeredNew}]) {
        const idempotent=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',nativeStubs+fs.readFileSync(nativeSource,'utf8')],{
          input:JSON.stringify({action:'register',name:'Claude',family:oldInfo.packageFamilyName,registeredFullName:path.basename(oldRoot),candidateFullName:candidate.packageFullName,...situation}),
          encoding:'utf8',windowsHide:true
        });
        assert.equal(idempotent.status,0,'Already completed registration must not fail or issue another Add: '+idempotent.stderr);
        assert.equal(JSON.parse(idempotent.stdout).packageFullName,candidate.packageFullName);
      }
      // Characters outside both English and Chinese ANSI code pages exercise the
      // native Unicode persistence path, including a toolkit under a Unicode root.
      const shortPath=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type 'using System.Text;using System.Runtime.InteropServices;public class ShortcutTestPath{[DllImport("kernel32.dll",CharSet=CharSet.Unicode)]public static extern uint GetShortPathName(string path,StringBuilder output,uint length);}'
$buffer=New-Object Text.StringBuilder 32768
$length=[ShortcutTestPath]::GetShortPathName($request.path,$buffer,32768)
if($length -eq 0){throw 'Could not inspect fixture path'}
@{path=$buffer.ToString()} | ConvertTo-Json -Compress
`],{input:JSON.stringify({path:root}),encoding:'utf8',windowsHide:true});
      assert.equal(shortPath.status,0,shortPath.stderr);
      const shortcutRoot = path.join(JSON.parse(shortPath.stdout).path,'中文目录-😀');
      fs.mkdirSync(path.join(shortcutRoot,'core'),{recursive:true});
      for(const file of ['windows-shortcut.js','windows-shortcut.ps1']) {
        fs.copyFileSync(path.join(__dirname,'../core',file),path.join(shortcutRoot,'core',file));
      }
      fs.writeFileSync(path.join(shortcutRoot,'launch.bat'),'@echo off\r\n');
      const shortcut = path.join(shortcutRoot,'Claude 中文 😀 test.lnk');
      const create = require(path.join(shortcutRoot,'core/windows-shortcut')).createLaunchShortcut;
      const saved = create(shortcut);
      assert.equal(saved.output,shortcut);
      assert.equal(saved.target,fs.realpathSync.native(path.join(shortcutRoot,'launch.bat')));
      assert.equal(saved.workingDirectory,fs.realpathSync.native(shortcutRoot));
      const first = fs.readFileSync(shortcut);
      create(shortcut);
      assert.deepEqual(fs.readFileSync(shortcut+'.before-claude-chinese.bak'),first,'Preserve a replaced shortcut');
      for(const explicitIcon of [true,false]) {
      const seed = path.join(root,'existing.lnk');
      const initialized=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
$link=(New-Object -ComObject WScript.Shell).CreateShortcut($request.output)
$link.TargetPath=$request.target
$link.Arguments='--version'
if($request.explicitIcon){$link.IconLocation=$request.target+',0'}
$link.Save()
`],{input:JSON.stringify({output:seed,target:process.execPath,explicitIcon}),encoding:'utf8',windowsHide:true});
      assert.equal(initialized.status,0,initialized.stderr);
      const existing=path.join(shortcutRoot,`Existing 中文 😀 ${explicitIcon}.lnk`);
      fs.renameSync(seed,existing);
      const original=fs.readFileSync(existing);
      const replaced=create(existing);
      assert.equal(replaced.iconPath.toLowerCase(),process.execPath.toLowerCase(),'Keep the original icon');
      assert.equal(replaced.iconIndex,'0');
      assert.deepEqual(fs.readFileSync(existing+'.before-claude-chinese.bak'),original);
      create(existing);
      assert.deepEqual(fs.readFileSync(existing+'.before-claude-chinese.bak'),original,'Never overwrite the first backup');
      }
    }
    console.log('PASS: broken registered package recovers only to a verified newer same-family package; active clients, untrusted candidates and damaged resources stop safely');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
