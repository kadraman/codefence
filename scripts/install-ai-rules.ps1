param(
  [string]$TargetDir = ".",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $TargetDir

$extra = @()
if ($DryRun) { $extra += "--dry-run" }

if (Get-Command codefence -ErrorAction SilentlyContinue) {
  & codefence install @extra
  exit $LASTEXITCODE
}

$cli = Join-Path $RepoRoot "dist\src\cli.js"
if (Test-Path $cli) {
  & node $cli install @extra
  exit $LASTEXITCODE
}

Write-Error "codefence not found. Install codefence or run npm run build in the codefence repo."
exit 1
