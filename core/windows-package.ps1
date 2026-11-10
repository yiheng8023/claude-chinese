$ErrorActionPreference = 'Stop'
# This Windows PowerShell child uses Windows system cmdlets. An inherited
# PowerShell 7 module path can shadow the built-in signature cmdlet.
$env:PSModulePath = Join-Path $PSHOME 'Modules'
Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$registered = Get-AppxPackage -Name $request.name | Where-Object PackageFamilyName -eq $request.family | Select-Object -First 1
if (-not $registered) { throw 'Claude 的系统注册已变化，请重新检查安装状态。' }

function Read-Candidate([string]$fullName) {
    if ($fullName -notmatch '^(Claude|AnthropicPBC\.Claude)_(\d+\.\d+\.\d+\.\d+)_(x64|arm64)__([a-z0-9]{13})$') { return }
    $candidateName = $Matches[1]
    $candidateVersion = [version]$Matches[2]
    $candidateFamily = $candidateName + '_' + $Matches[4]
    if ($candidateName -ne $registered.Name -or $candidateFamily -ne $registered.PackageFamilyName -or $candidateVersion -le [version]$registered.Version) { return }
    $candidateRoot = Join-Path (Split-Path -Parent $registered.InstallLocation) $fullName
    if (-not (Test-Path -LiteralPath $candidateRoot -PathType Container)) { return }
    if ((Get-Item -LiteralPath $candidateRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { return }
    $manifestPath = Join-Path $candidateRoot 'AppxManifest.xml'
    [xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw
    [xml]$originalManifest = Get-Content -LiteralPath (Join-Path $registered.InstallLocation 'AppxManifest.xml') -Raw
    if ($manifest.Package.Identity.Name -ne $registered.Name -or $manifest.Package.Identity.Publisher -ne $originalManifest.Package.Identity.Publisher -or [version]$manifest.Package.Identity.Version -ne $candidateVersion) { return }
    $signature = Get-AuthenticodeSignature -LiteralPath (Join-Path $candidateRoot 'app\claude.exe')
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -ne $manifest.Package.Identity.Publisher) { return }
    [pscustomobject]@{ packageFullName=$fullName; version=$candidateVersion.ToString(); installPath=$candidateRoot; family=$candidateFamily; signatureValid=$true }
}

if ($request.action -eq 'discover') {
    $events = @(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-AppXDeploymentServer/Operational'; Id=658; StartTime=(Get-Date).AddDays(-30)} -MaxEvents 256 -ErrorAction SilentlyContinue)
    $names = foreach ($event in $events) {
        [xml]$xml = $event.ToXml()
        $fields = @{}
        foreach ($field in $xml.Event.EventData.Data) { $fields[$field.Name] = $field.'#text' }
        if ($fields.PackageMoniker -eq $registered.PackageFullName) { $fields.PackageMoniker2 }
    }
    $candidates = @($names | Select-Object -Unique | ForEach-Object {
        try { Read-Candidate $_ } catch { } # A stale/incomplete deployment record must not hide other candidates.
    })
    ConvertTo-Json -InputObject $candidates -Compress
} elseif ($request.action -eq 'register') {
    if ($registered.PackageFullName -eq $request.candidateFullName) {
        ConvertTo-Json -InputObject @{registered=$true; packageFullName=$registered.PackageFullName} -Compress
        exit 0
    }
    if ($registered.PackageFullName -ne $request.registeredFullName) { throw 'Claude 的系统注册已变化，未继续修改。' }
    $candidate = Read-Candidate $request.candidateFullName
    if (-not $candidate) { throw '待注册新版未通过身份和签名检查，未执行注册。' }
    $current = Get-AppxPackage -Name $registered.Name | Where-Object PackageFamilyName -eq $registered.PackageFamilyName | Select-Object -First 1
    if ($current.PackageFullName -eq $candidate.packageFullName) {
        ConvertTo-Json -InputObject @{registered=$true; packageFullName=$current.PackageFullName} -Compress
        exit 0
    }
    if ($current.PackageFullName -ne $request.registeredFullName) { throw 'Claude 的系统注册已变化，未继续修改。' }
    if (Get-Process -Name claude -ErrorAction SilentlyContinue) { throw 'Claude 正在运行，请先保存工作并退出客户端。' }
    Add-AppxPackage -Register (Join-Path $candidate.installPath 'AppxManifest.xml') -DisableDevelopmentMode -ForceApplicationShutdown
    $after = Get-AppxPackage -Name $registered.Name | Where-Object PackageFamilyName -eq $registered.PackageFamilyName | Select-Object -First 1
    if ($after.PackageFullName -ne $candidate.packageFullName) { throw '新版注册尚未生效，未继续汉化或启动。' }
    ConvertTo-Json -InputObject @{registered=$true; packageFullName=$after.PackageFullName} -Compress
} else { throw 'Unknown package action' }
