# NJUVaChampion - stop all services started by start-all.ps1
#
# Usage:  .\stop-all.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidsFile = Join-Path $root '.run\pids.json'

if (-not (Test-Path $pidsFile)) {
    Write-Host 'No .run\pids.json found - nothing to stop.' -ForegroundColor Yellow
    exit 0
}

$running = Get-Content $pidsFile -Raw | ConvertFrom-Json
$stopped = 0
foreach ($prop in $running.PSObject.Properties) {
    $svcPid = [int]$prop.Value
    Write-Host ("[stop] {0} (PID {1})" -f $prop.Name, $svcPid) -ForegroundColor Cyan
    taskkill /PID $svcPid /T /F | Out-Null
    $stopped++
}
Remove-Item $pidsFile -Force
Write-Host ("Stopped {0} service(s)." -f $stopped) -ForegroundColor Green
