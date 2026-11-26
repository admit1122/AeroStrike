# Builds dist\AeroStrike.zip, the file to upload to CrazyGames.
# Run it from the VS Code terminal:
#   powershell -ExecutionPolicy Bypass -File .\make-zip.ps1
# (Windows blocks .ps1 scripts by default; "Bypass" allows just this one run.)
# It contains only what the game needs: index.html, style.css and the js folder.
#
# Why not Compress-Archive? On Windows PowerShell 5.1 it saves paths as "js\audio.js"
# (backslash). Web servers expect "js/audio.js" (forward slash), so we build the zip ourselves.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$files = @("index.html", "style.css") + (Get-ChildItem js -Filter *.js | ForEach-Object { "js/" + $_.Name })
foreach ($f in $files) {
    if (-not (Test-Path $f)) { throw "Missing $f - are you in the AeroStrike folder?" }
}

New-Item -ItemType Directory -Force -Path "dist" | Out-Null
$zipPath = Join-Path $PSScriptRoot "dist\AeroStrike.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, "Create")
try {
    foreach ($f in $files) {
        $full = Join-Path $PSScriptRoot $f
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $full, $f, "Optimal") | Out-Null
    }
} finally { $zip.Dispose() }

$sizeKB = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host "Built dist\AeroStrike.zip ($sizeKB KB, $($files.Count) files). CrazyGames limit is 50 MB, so you're fine."
