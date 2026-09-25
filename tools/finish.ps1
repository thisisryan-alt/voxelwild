<#
.SYNOPSIS
  Does every remaining step on a Windows machine with Unity installed, one after another, and writes a
  report: get the latest code, rebuild the generated scenes and assets, run both test suites, take the
  screenshot tour, and build the game (Builds/Windows/Voxelwild.exe).

.DESCRIPTION
  Double-click Finish.bat in the project folder, or run:  powershell -ExecutionPolicy Bypass -File tools/finish.ps1
  Each step keeps going even if an earlier one failed, so one run shows everything that needs fixing.
  The report is Logs/finish-report.txt: send it (and the Screenshots folder) back to Claude.

.PARAMETER SkipPull     Don't fetch the latest code first.
.PARAMETER SkipCapture  Skip the screenshot tour (the slowest step).
.PARAMETER Play         Start the game when everything is done.
#>
param(
    [switch]$SkipPull,
    [switch]$SkipCapture,
    [switch]$Play,
    [string]$Branch = "claude/epic-franklin-ka1ix5"
)

$project = (Resolve-Path "$PSScriptRoot/..").Path
Set-Location $project
New-Item -ItemType Directory -Force "$project/Logs" | Out-Null
$report = "$project/Logs/finish-report.txt"
$results = New-Object System.Collections.Generic.List[string]
$started = Get-Date
"Voxelwild finish run, $started" | Out-File -Encoding utf8 $report

function Write-Report([string]$text) {
    Write-Host $text
    $text | Out-File -Encoding utf8 -Append $report
}

function Invoke-Step([string]$name, [scriptblock]$body) {
    Write-Report ""
    Write-Report "==== $name ===="
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $ok = $true
    try {
        $global:LASTEXITCODE = 0
        & $body *>&1 | ForEach-Object { Write-Report "$_" }   # *> also catches Write-Host output
        if ($LASTEXITCODE -ne 0) { $ok = $false }
    }
    catch {
        Write-Report "ERROR: $($_.Exception.Message)"
        $ok = $false
    }
    $status = if ($ok) { "ok  " } else { "FAIL" }
    $line = "{0}  {1}  ({2:n0}s)" -f $status, $name, $sw.Elapsed.TotalSeconds
    $results.Add($line)
    Write-Report $line
    return $ok
}

# Unity can't open the project in the background while the editor has it open
if (Get-Process -Name Unity -ErrorAction SilentlyContinue) {
    Write-Report "Unity is open. Close every Unity window (Unity Hub can stay open), then run this again."
    exit 1
}

# 1. latest code (the 3D models and textures come through Git LFS)
if (-not $SkipPull) {
    $pulled = Invoke-Step "Get the latest code" {
        git fetch origin
        if ($LASTEXITCODE -ne 0) { return }
        git checkout $Branch
        if ($LASTEXITCODE -ne 0) { return }
        git pull --ff-only origin $Branch
        if ($LASTEXITCODE -ne 0) { return }
        git lfs pull
    }
    if (-not $pulled) {
        Write-Report ""
        Write-Report "Could not get the latest code (see above), so nothing was built. If git mentions local changes,"
        Write-Report "run 'git stash' in this folder and try again, or send this report to Claude."
        exit 1
    }
}

# 2. everything generated from code: texture arrays, prop library, both scenes
$built = Invoke-Step "Build textures, props and scenes (Voxelwild > Build All)" { & "$PSScriptRoot/unity.ps1" build }

# 3. tests
Invoke-Step "EditMode tests" { & "$PSScriptRoot/unity.ps1" test -Platform EditMode } | Out-Null
if ($built) { Invoke-Step "PlayMode tests" { & "$PSScriptRoot/unity.ps1" test -Platform PlayMode } | Out-Null }
else { $results.Add("skip  PlayMode tests (the scenes did not build)"); Write-Report "skip  PlayMode tests (the scenes did not build)" }

# 4. screenshot tour + performance report
if (-not $SkipCapture -and $built) {
    Invoke-Step "Screenshot tour (Screenshots/)" { & "$PSScriptRoot/unity.ps1" capture -TimeoutMinutes 45 } | Out-Null
}

# 5. the game itself
$player = $false
if ($built) { $player = Invoke-Step "Build the game (Builds/Windows/Voxelwild.exe)" { & "$PSScriptRoot/unity.ps1" player -TimeoutMinutes 60 } }

Write-Report ""
Write-Report "==== Summary ($([int]((Get-Date) - $started).TotalMinutes) min) ===="
foreach ($r in $results) { Write-Report $r }
Write-Report ""
Write-Report "Report: $report"
Write-Report "Send this report (and a few pictures from the Screenshots folder) back to Claude."

$exe = "$project/Builds/Windows/Voxelwild.exe"
if ($Play -and $player -and (Test-Path $exe)) { Start-Process $exe }
if ($results | Where-Object { $_ -like "FAIL*" }) { exit 1 }
exit 0
