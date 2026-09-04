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

Write-Host "Installing $($installer.Name) -> $dest"
$setup = Start-Process -FilePath $installer.FullName -ArgumentList @("/S", "/D=$dest") -Wait -PassThru
if ($setup.ExitCode -ne 0) {
    throw "NSIS installer exited $($setup.ExitCode)"
}

$exe = Get-ChildItem -Path $dest -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -notmatch "(?i)uninstall" } |
    Select-Object -First 1
if (-not $exe) {
    foreach ($candidate in @(
            (Join-Path $env:LOCALAPPDATA "MonoCode\MonoCode.exe"),
            (Join-Path $env:LOCALAPPDATA "Programs\MonoCode\MonoCode.exe")
        )) {
        if (Test-Path $candidate) {
            $exe = Get-Item $candidate
            break
        }
    }
}
if (-not $exe) {
    Get-ChildItem -Path $dest -Recurse | ForEach-Object { Write-Host $_.FullName }
    throw "installed tree has no MonoCode.exe"
}

Write-Host "Launching $($exe.FullName)"
$app = Start-Process -FilePath $exe.FullName -PassThru
$deadline = (Get-Date).AddSeconds(20)
while (-not $app.HasExited -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $app.Refresh()
}
if ($app.HasExited) {
    throw "MonoCode exited $($app.ExitCode) during first-run smoke"
}

Write-Host "Process $($app.Id) still running after first-run wait"
Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.ProcessName -match "(?i)monocode" } | Stop-Process -Force -ErrorAction SilentlyContinue
$uninstaller = Get-ChildItem -Path $dest -Filter "*.exe" -Recurse |
    Where-Object { $_.BaseName -match "(?i)uninstall" } |
    Select-Object -First 1
if ($uninstaller) {
    Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S" -Wait -ErrorAction SilentlyContinue
}
