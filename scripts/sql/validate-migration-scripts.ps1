param(
  [Parameter(Mandatory = $false)]
  [string]$SqlRoot = 'docs'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SqlRoot)) {
  throw "Le dossier SQL est introuvable: $SqlRoot"
}

$files = Get-ChildItem -Path $SqlRoot -Filter 'migration-*.sql' -File | Sort-Object Name
if ($files.Count -eq 0) {
  throw "Aucun fichier migration-*.sql trouve dans $SqlRoot"
}

$forbiddenPatterns = @(
  '(?im)\bdrop\s+database\b',
  '(?im)\bdrop\s+schema\s+public\b'
)

$violations = @()

foreach ($file in $files) {
  $content = Get-Content -LiteralPath $file.FullName -Raw

  foreach ($pattern in $forbiddenPatterns) {
    if ($content -match $pattern) {
      $violations += "[$($file.Name)] pattern interdit detecte: $pattern"
    }
  }
}

if ($violations.Count -gt 0) {
  Write-Host '[VALIDATION] Violations detectees:'
  $violations | ForEach-Object { Write-Host "- $_" }
  throw 'Validation SQL echouee.'
}

Write-Host "[VALIDATION] OK - $($files.Count) scripts verifies sans pattern critique."
