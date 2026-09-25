<#
.SYNOPSIS
  Runs the Blender prop pipeline headless (tools/blender/*.py).

.EXAMPLE
  ./tools/blender.ps1 build                      # generate, bake, LOD and export every prop
  ./tools/blender.ps1 build -Only Rock_Boulder   # one kind (other manifest records are kept)
  ./tools/blender.ps1 check                      # re-import every FBX and validate it
  ./tools/blender.ps1 check -Determinism         # also rebuild one prop per family twice and compare bytes
  ./tools/blender.ps1 preview                    # labelled contact sheet into Screenshots/props_preview.png
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("build", "check", "preview")]
    [string]$Task,
    [string]$Only = "",
    [switch]$Determinism,
    [string]$BlenderPath = $env:BLENDER
)

$ErrorActionPreference = "Stop"
$project = (Resolve-Path "$PSScriptRoot/..").Path

if (-not $BlenderPath) {
    $candidates = @(
        "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
        "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe",
        "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe"
    )
    $BlenderPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $BlenderPath) {
        $cmd = Get-Command blender -ErrorAction SilentlyContinue
        if ($cmd) { $BlenderPath = $cmd.Source }
    }
    if (-not $BlenderPath) { throw "Blender not found; set BLENDER to blender.exe" }
}

# Pillow and numpy must be importable by Blender's bundled Python (one-off):
#   & "<blender dir>/5.2/python/bin/python.exe" -m pip install numpy Pillow
$script = switch ($Task) {
    "build"   { "build_props.py" }
    "check"   { "check_props.py" }
    "preview" { "preview_props.py" }
}
$scriptArgs = @()
if ($Only) { $scriptArgs += @("--only", $Only) }
if ($Determinism) { $scriptArgs += "--determinism" }

$bArgs = @("--background", "--factory-startup", "--python-exit-code", "1",
           "--python", "`"$project/tools/blender/$script`"", "--") + $scriptArgs
Write-Host "Blender: $BlenderPath"
Write-Host "Args   : $($bArgs -join ' ')"
$sw = [Diagnostics.Stopwatch]::StartNew()
& $BlenderPath @bArgs
$code = $LASTEXITCODE
Write-Host ("Exit code {0} after {1:n0}s" -f $code, $sw.Elapsed.TotalSeconds)
exit $code
