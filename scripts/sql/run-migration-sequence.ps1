param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString,

  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'staging', 'prod')]
  [string]$Environment,

  [Parameter(Mandatory = $false)]
  [string]$OutputReportPath = "docs/reports/migration-report-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss').md",

  [Parameter(Mandatory = $false)]
  [string]$BackupPath
)

$ErrorActionPreference = 'Stop'

if ($Environment -eq 'prod' -and [string]::IsNullOrWhiteSpace($BackupPath)) {
  throw "En production, -BackupPath est obligatoire pour prouver qu'une sauvegarde a ete realisee avant migration."
}

if (-not [string]::IsNullOrWhiteSpace($BackupPath) -and -not (Test-Path -LiteralPath $BackupPath)) {
  throw "Le fichier de sauvegarde specifie est introuvable: $BackupPath"
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql est introuvable. Installez PostgreSQL client et reessayez."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$migrationFiles = @(
  'docs/migration-task-status-workflow.sql',
  'docs/migration-task-delete-guard.sql',
  'docs/migration-task-dependency-cycle-guard.sql',
  'docs/migration-task-dependency-rls-hardening.sql',
  'docs/migration-security-definer-search-path.sql',
  'docs/migration-security-definer-execute-privileges.sql',
  'docs/migration-security-definer-posture-checks.sql',
  'docs/migration-task-dependency-constraints-hardening.sql',
  'docs/migration-task-governance-posture-checks.sql',
  'docs/migration-release-gate-check.sql',
  'docs/migration-task-dependency-integrity-checks.sql',
  'docs/migration-task-dependency-smoke-tests.sql'
)

$preflightFile = 'docs/migration-task-dependency-preflight-report.sql'

if (-not (Test-Path -LiteralPath $preflightFile)) {
  throw "Le script de preflight est introuvable: $preflightFile"
}

$missingFiles = @($migrationFiles | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missingFiles.Count -gt 0) {
  throw "Fichiers de migration introuvables: $($missingFiles -join ', ')"
}

$duplicateFiles = @($migrationFiles | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
if ($duplicateFiles.Count -gt 0) {
  throw "Doublons detectes dans la sequence de migration: $($duplicateFiles -join ', ')"
}

$outputDir = Split-Path -Parent $OutputReportPath
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$backupPathLabel = 'N/A'
if (-not [string]::IsNullOrWhiteSpace($BackupPath)) {
  $backupPathLabel = $BackupPath
}

$report = @()
$report += "# Migration Report"
$report += ""
$report += "- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
$report += "- Environment: $Environment"
$report += "- Operator: $env:USERNAME"
$report += "- BackupPath: $backupPathLabel"
$report += ""
$report += "## Preflight"

$report += "## Script Integrity"
$report += "- Preflight SHA256: $((Get-FileHash -Algorithm SHA256 -LiteralPath $preflightFile).Hash)"
foreach ($file in $migrationFiles) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash
  $report += "- $file SHA256: $hash"
}
$report += ""
$report += "## Preflight"

$preflightStart = Get-Date
try {
  $preflightOutput = & psql "$ConnectionString" -v ON_ERROR_STOP=1 -f $preflightFile 2>&1
  $preflightEnd = Get-Date
  $report += "- Script: $preflightFile"
  $report += "- Start: $($preflightStart.ToString('s'))"
  $report += "- End: $($preflightEnd.ToString('s'))"
  $report += "- Result: OK"
  $report += ""
  $report += "--- output ---"
  $report += ($preflightOutput | Out-String).TrimEnd()
  $report += "--- end output ---"
  $report += ""
}
catch {
  $preflightEnd = Get-Date
  $report += "- Script: $preflightFile"
  $report += "- Start: $($preflightStart.ToString('s'))"
  $report += "- End: $($preflightEnd.ToString('s'))"
  $report += "- Result: KO"
  $report += ""
  $report += "--- output ---"
  $report += $_.Exception.Message
  $report += "--- end output ---"
  $report += ""
  $report | Set-Content -Path $OutputReportPath -Encoding UTF8
  throw "Preflight en echec. Rapport ecrit: $OutputReportPath"
}

$report += "## Migration Sequence"

foreach ($file in $migrationFiles) {
  $start = Get-Date
  try {
    $output = & psql "$ConnectionString" -v ON_ERROR_STOP=1 -f $file 2>&1
    $end = Get-Date
    $report += "### $file"
    $report += "- Start: $($start.ToString('s'))"
    $report += "- End: $($end.ToString('s'))"
    $report += "- Result: OK"
    $report += ""
    $report += "--- output ---"
    $report += ($output | Out-String).TrimEnd()
    $report += "--- end output ---"
    $report += ""
  }
  catch {
    $end = Get-Date
    $report += "### $file"
    $report += "- Start: $($start.ToString('s'))"
    $report += "- End: $($end.ToString('s'))"
    $report += "- Result: KO"
    $report += ""
    $report += "--- output ---"
    $report += $_.Exception.Message
    $report += "--- end output ---"
    $report += ""
    $report += "## Final Verdict"
    $report += "- Status: FAILED"
    $report | Set-Content -Path $OutputReportPath -Encoding UTF8
    throw "Migration interrompue sur $file. Rapport ecrit: $OutputReportPath"
  }
}

$report += "## Final Verdict"
$report += "- Status: PASSED"
$report | Set-Content -Path $OutputReportPath -Encoding UTF8

Write-Host "Sequence terminee avec succes. Rapport: $OutputReportPath"
