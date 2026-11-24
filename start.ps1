param([switch]$Check)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$candidates = @()
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
if ($nodeCommand) { $candidates += $nodeCommand.Source }
$candidates += @('C:\Program Files\nodejs\node.exe', 'C:\Program Files (x86)\nodejs\node.exe')
try {
  $packages = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' -ErrorAction Stop | Sort-Object Version -Descending
  foreach ($package in $packages) { $candidates += Join-Path $package.InstallLocation 'dependencies\node\bin\node.exe' }
} catch { }
try {
  $runtimes = Get-ChildItem -LiteralPath 'C:\Program Files\WindowsApps' -Directory -Filter 'OpenAI.CodexPrimaryRuntime*' -ErrorAction Stop | Sort-Object Name -Descending
  foreach ($runtime in $runtimes) { $candidates += Join-Path $runtime.FullName 'dependencies\node\bin\node.exe' }
} catch { }
$nodePath = $candidates | Select-Object -Unique | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $nodePath) { throw 'Node.js was not found. Install Node.js 20.12 or later, then reopen this launcher.' }
$versionText = & $nodePath --version
if ($LASTEXITCODE -ne 0) { throw 'Node.js could not start.' }
$nodeVersion = [version]($versionText.TrimStart('v'))
if ($nodeVersion -lt [version]'20.12.0') { throw 'Node.js 20.12 or later is required.' }
Write-Host "Node: $nodePath ($versionText)"
if ($Check) { Write-Host 'Launcher check passed.'; exit 0 }
Write-Host 'Keep this window open while using the demo. Press Ctrl+C to stop.'
Write-Host 'Open the local URL printed below in your browser.'
& $nodePath (Join-Path $PSScriptRoot 'server.mjs')
exit $LASTEXITCODE
