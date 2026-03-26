# Veckoplan — Bump All Cache-Busting Versions
# Usage: .\bump-versions.ps1
# Bumps ALL ?v=N references in index.html AND all JS import statements to N+1

param(
    [string]$Path = $PSScriptRoot
)

if (-not $Path -or $Path -eq '') {
    $Path = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$indexFile = Join-Path $Path "index.html"
$srcDir = Join-Path $Path "src"

if (-not (Test-Path $indexFile)) {
    Write-Error "index.html not found at $indexFile"
    exit 1
}

# Find current max version number from index.html
$indexContent = Get-Content $indexFile -Raw
$matches = [regex]::Matches($indexContent, '\?v=(\d+)')
$currentMax = 0
foreach ($m in $matches) {
    $v = [int]$m.Groups[1].Value
    if ($v -gt $currentMax) { $currentMax = $v }
}

$newVersion = $currentMax + 1
Write-Host "Bumping all versions: v=$currentMax -> v=$newVersion" -ForegroundColor Cyan

# Bump index.html: replace ALL ?v=N with ?v=NEW
$newIndex = [regex]::Replace($indexContent, '\?v=\d+', "?v=$newVersion")
Set-Content $indexFile $newIndex -NoNewline
Write-Host "  Updated index.html" -ForegroundColor Green

# Bump all JS files in src/
$jsFiles = Get-ChildItem -Path "$srcDir\*.js"
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match '\?v=\d+') {
        $newContent = [regex]::Replace($content, '\?v=\d+', "?v=$newVersion")
        Set-Content $file.FullName $newContent -NoNewline
        Write-Host "  Updated $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`nAll versions bumped to v=$newVersion" -ForegroundColor Cyan
Write-Host "Remember to deploy: copy files to web-github and push!" -ForegroundColor Yellow
