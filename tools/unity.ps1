<#
.SYNOPSIS
  Runs the Unity editor in batch mode against this project and reports errors from the log.

.EXAMPLE
  ./tools/unity.ps1 build                 # build texture arrays + prop library + World scene
  ./tools/unity.ps1 test -Platform EditMode
  ./tools/unity.ps1 test -Platform PlayMode
  ./tools/unity.ps1 capture               # screenshots + perf report into Screenshots/
  ./tools/unity.ps1 turntable             # prop turntables into Screenshots/turntables/
  ./tools/unity.ps1 player                # Windows standalone build into Builds/
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("compile", "build", "test", "capture", "turntable", "player")]
    [string]$Task,
    [ValidateSet("EditMode", "PlayMode")]
    [string]$Platform = "EditMode",
    [string]$UnityPath = $env:UNITY_EDITOR,
    [int]$TimeoutMinutes = 30
)

$ErrorActionPreference = "Stop"
$project = (Resolve-Path "$PSScriptRoot/..").Path

if (-not $UnityPath) {
    $version = (Get-Content "$project/ProjectSettings/ProjectVersion.txt" | Select-String "m_EditorVersion:").ToString().Split(":")[1].Trim()
    $candidates = @(
        "C:/Program Files/Unity/Hub/Editor/$version-arm64/Editor/Unity.exe",
        "C:/Program Files/Unity/Hub/Editor/$version/Editor/Unity.exe"
    )
    # prefer the native editor for this machine's architecture
    if ($env:PROCESSOR_ARCHITECTURE -ne "ARM64") { [array]::Reverse($candidates) }
    $UnityPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $UnityPath) { throw "Unity $version not found; set UNITY_EDITOR" }
}

New-Item -ItemType Directory -Force "$project/Logs" | Out-Null
$log = "$project/Logs/batch-$Task.log"
$unityArgs = @("-batchmode", "-projectPath", "`"$project`"", "-logFile", "`"$log`"")

switch ($Task) {
    "compile" { $unityArgs += @("-quit") }
    "build"   { $unityArgs += @("-quit", "-executeMethod", "Voxelwild.EditorTools.WorldSceneBuilder.BuildAll") }
    "test"    {
        $results = "$project/TestResults/$Platform.xml"
        New-Item -ItemType Directory -Force "$project/TestResults" | Out-Null
        $unityArgs += @("-runTests", "-testPlatform", $Platform, "-testResults", "`"$results`"")
    }
    "capture" {
        $unityArgs += @("-executeMethod", "Voxelwild.EditorTools.CaptureRunner.Run", "-vwCapture", "`"$project/Screenshots`"")
    }
    "turntable" { $unityArgs += @("-quit", "-executeMethod", "Voxelwild.EditorTools.PropTurntable.CaptureAll") }
    "player"  { $unityArgs += @("-quit", "-executeMethod", "Voxelwild.EditorTools.PlayerBuild.BuildWindows") }
}

Write-Host "Unity: $UnityPath"
Write-Host "Args : $($unityArgs -join ' ')"
$sw = [Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath $UnityPath -ArgumentList $unityArgs -PassThru -WindowStyle Hidden
if (-not $proc.WaitForExit($TimeoutMinutes * 60 * 1000)) {
    $proc.Kill()
    throw "Unity timed out after $TimeoutMinutes minutes (log: $log)"
}
$code = $proc.ExitCode
Write-Host ("Exit code {0} after {1:n0}s" -f $code, $sw.Elapsed.TotalSeconds)

$errors = Select-String -Path $log -Pattern "error CS\d+|Shader error|Compilation failed|Exception:|\[Error\]|ERROR" -ErrorAction SilentlyContinue |
    Where-Object { $_.Line -notmatch "Curl error|DisplayProgressbar|Licensing|\[Licensing|Unable to listen" } |
    Select-Object -First 40
if ($errors) { Write-Host "---- log issues ----"; $errors | ForEach-Object { Write-Host $_.Line } }

if ($Task -eq "test" -and (Test-Path $results)) {
    [xml]$xml = Get-Content $results
    $run = $xml.'test-run'
    Write-Host ("Tests: {0} total, {1} passed, {2} failed, {3} skipped" -f $run.total, $run.passed, $run.failed, $run.skipped)
    $xml.SelectNodes("//test-case[@result='Failed']") | ForEach-Object {
        Write-Host "FAIL $($_.fullname)"
        Write-Host "     $($_.failure.message.'#cdata-section')"
    }
}
exit $code
