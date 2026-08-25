# NJUVaChampion - one-command launcher (Windows PowerShell)
#
# Starts backend (8080), frontend (3000) and OCR (3200) each in its own window.
# Prerequisites: JDK 21, Maven, Node 20+ on PATH; MySQL listening on 127.0.0.1:3306.
# OCR keeps the PaddleOCR engine, so the "valorant-ocr" conda env is recommended.
#
# Usage:  .\start-all.ps1
# Stop:   .\stop-all.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$runDir = Join-Path $root '.run'
if (-not (Test-Path $runDir)) { New-Item -ItemType Directory -Path $runDir | Out-Null }

# ---------- load local env file (gitignored .env.local) ----------
$envFile = Join-Path $root '.env.local'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#')) {
            $idx = $line.IndexOf('=')
            if ($idx -gt 0) {
                $key = $line.Substring(0, $idx).Trim()
                $val = $line.Substring($idx + 1).Trim()
                if ($null -eq [Environment]::GetEnvironmentVariable($key, 'Process')) {
                    [Environment]::SetEnvironmentVariable($key, $val, 'Process')
                }
            }
        }
    }
    Write-Host "[env] loaded $envFile" -ForegroundColor DarkGray
}

function Test-Port([int]$port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

# ---------- preflight checks ----------
$missing = @()
foreach ($c in @('java', 'mvn', 'node', 'npm')) {
    if ($null -eq (Get-Command $c -ErrorAction SilentlyContinue)) { $missing += $c }
}
if ($missing.Count -gt 0) {
    Write-Host ("[FAIL] Missing prerequisites: {0}" -f ($missing -join ', ')) -ForegroundColor Red
    Write-Host 'Install JDK 21 / Maven / Node 20+ and add them to PATH, then re-run.' -ForegroundColor Red
    exit 1
}

if (-not (Test-Port 3306)) {
    Write-Host '[WARN] MySQL is not listening on 127.0.0.1:3306. The backend cannot boot without it.' -ForegroundColor Yellow
}

if (-not $env:DB_PASSWORD) {
    Write-Host '[WARN] DB_PASSWORD is not set (env var or .env.local); the backend cannot connect to MySQL.' -ForegroundColor Yellow
    Write-Host '        Set it, e.g.:  $env:DB_PASSWORD = "your-password"  (or add DB_PASSWORD=... to .env.local)' -ForegroundColor Yellow
}

$paddlePythons = @(
    (Join-Path $env:USERPROFILE '.conda\envs\valorant-ocr\python.exe'),
    (Join-Path $env:USERPROFILE 'anaconda3\envs\valorant-ocr\python.exe'),
    (Join-Path $env:USERPROFILE 'miniconda3\envs\valorant-ocr\python.exe')
)
$paddleFound = $false
foreach ($p in $paddlePythons) { if (Test-Path $p) { $paddleFound = $true; break } }
if (-not $paddleFound) {
    Write-Host '[WARN] valorant-ocr conda env not found. OCR will start, but recognition may fail.' -ForegroundColor Yellow
}

# ---------- launch ----------
$script:pids = @{}

function Start-ServiceWin([string]$name, [string]$workdir, [int]$port, [string]$cmdline) {
    if (Test-Port $port) {
        Write-Host ("[skip] {0}: port {1} already in use" -f $name, $port) -ForegroundColor Yellow
        return
    }
    $full = "title $name && $cmdline"
    $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList "/k `"$full`"" -WorkingDirectory $workdir -PassThru
    $script:pids[$name] = [int]$proc.Id
    Write-Host ("[start] {0} -> :{1} (PID {2})" -f $name, $port, $proc.Id) -ForegroundColor Cyan
}

Start-ServiceWin 'backend'  (Join-Path $root 'backend')             8080 'mvn.cmd spring-boot:run'
Start-ServiceWin 'frontend' (Join-Path $root 'frontend')            3000 'npm run dev'
Start-ServiceWin 'ocr'      (Join-Path $root 'valorant-ocr')        3200 'npm start'

if ($pids.Count -eq 0) {
    Write-Host 'Nothing launched - all ports already busy.' -ForegroundColor Yellow
    exit 0
}

$pids | ConvertTo-Json | Set-Content -Path (Join-Path $runDir 'pids.json') -Encoding UTF8

# ---------- wait for ports ----------
function Wait-Port([int]$port, [int]$timeoutSec, [string]$label) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        if (Test-Port $port) {
            Write-Host ("[ok]   {0} ready on :{1}" -f $label, $port) -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 1
    }
    Write-Host ("[warn] {0} did not open :{1} within {2}s - check its window." -f $label, $port, $timeoutSec) -ForegroundColor Yellow
}

if ($pids.ContainsKey('backend'))  { Wait-Port 8080 150 'backend' }
if ($pids.ContainsKey('frontend')) { Wait-Port 3000 120 'frontend' }
if ($pids.ContainsKey('ocr'))      { Wait-Port 3200 60  'ocr' }

Write-Host ''
Write-Host 'All done. Frontend: http://localhost:3000' -ForegroundColor Green
Write-Host 'Stop everything with: .\stop-all.ps1' -ForegroundColor Green
