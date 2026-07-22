$ErrorActionPreference = 'Stop'
$cacheDir = "$env:USERPROFILE\AppData\Local\electron-builder\Cache\winCodeSign"
if (-Not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir | Out-Null
}

$zipPath = Join-Path $cacheDir "winCodeSign.7z"
Invoke-WebRequest -Uri "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z" -OutFile $zipPath

$extractDir = Join-Path $cacheDir "winCodeSign-2.6.0"
if (-Not (Test-Path $extractDir)) {
    New-Item -ItemType Directory -Path $extractDir | Out-Null
}

$sevenZip = "H:\argus\node_modules\7zip-bin\win\x64\7za.exe"
& $sevenZip x -bd $zipPath "-o$extractDir"

Remove-Item $zipPath -Force
Write-Host "Cache preparation complete."
