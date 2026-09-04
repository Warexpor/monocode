# Silent-install the NSIS bundle and prove the app process stays up.
# Unix analog: installing the .deb/.dmg and launching once.
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$nsisDir = Join-Path $root "target\release\bundle\nsis"
$installer = Get-ChildItem -Path $nsisDir -Filter "*.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $installer) {
    throw "no NSIS installer under $nsisDir"
}

$dest = Join-Path $root "target\nsis-smoke"
if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
}
New-Item -ItemType Directory -Force $dest | Out-Null

# /D= must be last and unquoted (NSIS). Start-Process would quote it.
Write-Host "Installing $($installer.Name) -> $dest"
cmd.exe /c "`"$($installer.FullName)`" /S /D=$dest"
if ($LASTEXITCODE -ne 0) {
    throw "NSIS installer exited $LASTEXITCODE"
}

function Find-InstalledExe {
    $hits = @()
    if (Test-Path $dest) {
        $hits += Get-ChildItem -Path $dest -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue
    }
    foreach ($dir in @(
            (Join-Path $env:LOCALAPPDATA "MonoCode"),
            (Join-Path $env:LOCALAPPDATA "Programs\MonoCode")
        )) {
        if (Test-Path $dir) {
            $hits += Get-ChildItem -Path $dir -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue
        }
    }
    $hits | Where-Object { $_.BaseName -notmatch "(?i)uninstall" } | Select-Object -First 1
}

$deadline = (Get-Date).AddSeconds(60)
$exe = $null
while ((Get-Date) -lt $deadline) {
    $exe = Find-InstalledExe
    if ($exe) { break }
    Start-Sleep -Milliseconds 500
}
if (-not $exe) {
    Write-Host "dest listing:"
    if (Test-Path $dest) {
        Get-ChildItem -Path $dest -Recurse | ForEach-Object { Write-Host $_.FullName }
    }
    throw "installed tree has no MonoCode.exe"
}

Write-Host "Launching $($exe.FullName)"
$glass = Join-Path $env:TEMP "monocode-windows-glass.txt"
Remove-Item $glass -ErrorAction SilentlyContinue
$app = Start-Process -FilePath $exe.FullName -PassThru
$started = Get-Date
$minAlive = $started.AddSeconds(20)
$glassDeadline = $started.AddSeconds(45)
$effect = $null
$named = @()
$starterAlive = $true
while ((Get-Date) -lt $glassDeadline) {
    if ($app) { $app.Refresh() }
    $starterAlive = $app -and -not $app.HasExited
    $named = @(Get-Process | Where-Object { $_.ProcessName -match "(?i)monocode" })
    if ((Get-Date) -ge $minAlive -and -not $starterAlive -and $named.Count -eq 0) {
        $code = if ($app) { $app.ExitCode } else { "n/a" }
        throw "MonoCode was not running after first-run wait (exit $code)"
    }
    if (Test-Path $glass) {
        $effect = (Get-Content -Raw $glass).Trim()
    }
    if ($effect -and (Get-Date) -ge $minAlive) { break }
    Start-Sleep -Milliseconds 500
}
if ($app) { $app.Refresh() }
$starterAlive = $app -and -not $app.HasExited
$named = @(Get-Process | Where-Object { $_.ProcessName -match "(?i)monocode" })
if (-not $starterAlive -and $named.Count -eq 0) {
    $code = if ($app) { $app.ExitCode } else { "n/a" }
    throw "MonoCode was not running after first-run wait (exit $code)"
}
Write-Host "MonoCode still running after first-run wait (starterAlive=$starterAlive named=$($named.Count))"
if (-not $effect) {
    throw "Windows DWM apply did not record fallback at $glass"
}
$allowed = @("acrylic", "mica", "mica-dark", "blur", "solid")
if ($allowed -notcontains $effect) {
    throw "unexpected DWM fallback '$effect'"
}
Write-Host "DWM glass fallback=$effect"
Get-Process | Where-Object { $_.ProcessName -match "(?i)monocode" } | Stop-Process -Force -ErrorAction SilentlyContinue
if ($app -and -not $app.HasExited) {
    Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
}
$uninstaller = Get-ChildItem -Path $dest -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -match "(?i)uninstall" } |
    Select-Object -First 1
if ($uninstaller) {
    cmd.exe /c "`"$($uninstaller.FullName)`" /S" | Out-Null
}
