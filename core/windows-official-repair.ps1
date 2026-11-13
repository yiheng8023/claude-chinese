$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
Import-Module Microsoft.PowerShell.Security
Add-Type -AssemblyName System.IO.Compression.FileSystem
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
function Resolve-OfficialEntryPath([string]$entryName, [hashtable]$seen) {
    $relative = [Uri]::UnescapeDataString($entryName)
    if ($relative.Contains('\') -or $relative.Contains(':') -or $relative.Contains([char]0)) { throw 'Unsafe package entry path.' }
    if ($relative.EndsWith('/')) { return $null }
    if (@($relative.Split('/') | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' -or $_.EndsWith('.') -or $_.EndsWith(' ') }).Count) { throw 'Unsafe package entry path.' }
    if ($relative -notmatch '^app/(claude\.exe|resources/(app\.asar|ion-dist\.asar)(\.unpacked/.+)?)$') { return $null }
    if ($seen.ContainsKey($relative)) { throw 'Duplicate package entry path.' }
    $seen[$relative] = $true
    return $relative
}
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$registered = Get-AppxPackage -Name $request.name | Where-Object PackageFamilyName -eq $request.family | Select-Object -First 1
if (-not $registered -or $registered.Name -ne 'Claude' -or $registered.PackageFullName -ne $request.registeredFullName) { throw 'Claude registration changed before repair.' }
if (Get-Process -Name claude -ErrorAction SilentlyContinue) { throw 'Save work and exit Claude before repair.' }
[xml]$oldManifest = Get-Content -LiteralPath (Join-Path $registered.InstallLocation 'AppxManifest.xml') -Raw
if ($oldManifest.Package.Identity.Name -ne $registered.Name -or [version]$oldManifest.Package.Identity.Version -ne [version]$registered.Version -or $oldManifest.Package.Identity.ProcessorArchitecture -ne 'x64') { throw 'Automatic full-package repair requires a coherent Windows x64 registration.' }
$feed = Invoke-RestMethod -Uri ('https://releases.claude.com/api/desktop/win32/x64/msix/update?device_id=' + [guid]::NewGuid()) -TimeoutSec 30
$release = @($feed.releases | ForEach-Object { $_.updateTo } | Where-Object version -eq $feed.currentRelease)
if ($release.Count -ne 1) { throw 'The official release feed is ambiguous.' }
$release = $release[0]
if ($release.version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$' -or $release.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $release.size -le 0 -or $release.size -gt 2GB) { throw 'Invalid official release metadata.' }
$versionText = [string]$release.version
if ($versionText.Split('.').Count -eq 3) { $versionText += '.0' }
if ([version]$versionText -le [version]$registered.Version) { throw 'No newer official package is available for repair.' }
$expectedUrl = '^https://downloads\.claude\.ai/releases/win32/x64/' + [regex]::Escape($release.version) + '/Claude-[a-f0-9]{40}\.msix$'
if ($release.url -notmatch $expectedUrl) { throw 'The release URL is outside the official package endpoint.' }
$download = Join-Path ([IO.Path]::GetTempPath()) ('claude-cn-repair-' + [guid]::NewGuid() + '.msix')
$zip = $null
try {
    $http = [Net.HttpWebRequest]::Create($release.url)
    $http.AllowAutoRedirect = $false
    $http.Timeout = 30000
    $http.ReadWriteTimeout = 30000
    $response = $http.GetResponse()
    try {
        if ([int]$response.StatusCode -ne 200 -or $response.ContentLength -ne $release.size) { throw 'Unexpected official package response.' }
        $inputStream = $response.GetResponseStream()
        $outputStream = [IO.File]::Open($download, [IO.FileMode]::CreateNew)
        try {
            $buffer = New-Object byte[] 1048576
            $total = 0L
            while (($count = $inputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $total += $count
                if ($total -gt $release.size) { throw 'Official package exceeded its declared size.' }
                $outputStream.Write($buffer, 0, $count)
            }
            if ($total -ne $release.size) { throw 'Incomplete official package download.' }
            $outputStream.Flush($true)
        } finally { $outputStream.Dispose(); $inputStream.Dispose() }
    } finally { $response.Dispose() }
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $release.sha256) { throw 'Official package SHA256 mismatch.' }
    $signature = Get-AuthenticodeSignature -LiteralPath $download
    if ($signature.Status -ne 'Valid') { throw 'Official package signature is invalid.' }
    $zip = [IO.Compression.ZipFile]::OpenRead($download)
    $manifests = @($zip.Entries | Where-Object FullName -eq 'AppxManifest.xml')
    if ($manifests.Count -ne 1) { throw 'Invalid package manifest inventory.' }
    $reader = New-Object IO.StreamReader($manifests[0].Open())
    try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $identity = $manifest.Package.Identity
    if ($identity.Name -ne $registered.Name -or $identity.Version -ne $versionText -or $identity.ProcessorArchitecture -ne 'x64' -or $identity.Publisher -ne $oldManifest.Package.Identity.Publisher -or $identity.Publisher -ne $signature.SignerCertificate.Subject) { throw 'Official package identity mismatch.' }
    $current = Get-AppxPackage -Name $registered.Name | Where-Object PackageFamilyName -eq $request.family | Select-Object -First 1
    if ($current.PackageFullName -ne $request.registeredFullName -or (Get-Process -Name claude -ErrorAction SilentlyContinue)) { throw 'Claude changed while the official package was downloading.' }
    Add-AppxPackage -Path $download -ForceApplicationShutdown
    $after = Get-AppxPackage -Name $registered.Name | Where-Object PackageFamilyName -eq $request.family | Select-Object -First 1
    if ([version]$after.Version -ne [version]$versionText) { throw 'Official package registration did not complete.' }
    $hashes = @{}
    $seen = @{}
    foreach ($entry in $zip.Entries) {
        # MSIX ZIP names encode characters such as @ as %40. Decode once before
        # checking canonical paths and comparing the installed file inventory.
        $relative = Resolve-OfficialEntryPath $entry.FullName $seen
        if (-not $relative) { continue }
        $installed = Join-Path $after.InstallLocation $relative
        $item = Get-Item -LiteralPath $installed -Force
        while ($item.FullName.Length -ge $after.InstallLocation.Length) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked installation path is not accepted.' }
            if ($item.FullName -eq $after.InstallLocation) { break }
            $item = Get-Item -LiteralPath (Split-Path -Parent $item.FullName) -Force
        }
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() } finally { $stream.Dispose(); $sha.Dispose() }
        if ((Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash -ne $hash) { throw ('Installed official bytes differ: ' + $relative) }
        $hashes[$relative] = $hash
    }
    foreach ($required in @('app/claude.exe', 'app/resources/app.asar', 'app/resources/ion-dist.asar')) {
        if (-not $hashes.ContainsKey($required)) { throw 'Official package is missing a required artifact.' }
    }
    @{packageFullName=$after.PackageFullName;installPath=$after.InstallLocation;hashes=$hashes} | ConvertTo-Json -Depth 3 -Compress
} finally {
    if ($zip) { $zip.Dispose() }
    if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download -Force }
}
