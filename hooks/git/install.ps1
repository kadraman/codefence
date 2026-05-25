param(
  [string]$TargetDir = ".",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $TargetDir

$extra = @()
if ($DryRun) { $extra += "--dry-run" }

$cli = Join-Path $RepoRoot "dist\src\cli.js"
if (Test-Path $cli) {
  & node $cli install-hooks @extra
  exit $LASTEXITCODE
}

if (Get-Command codefence -ErrorAction SilentlyContinue) {
  & codefence install-hooks @extra
  exit $LASTEXITCODE
}

Write-Error "Build codefence first (npm run build) or install codefence globally."
exit 1
