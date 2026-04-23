param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString,

  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'staging', 'prod')]
  [string]$Environment,

  [Parameter(Mandatory = $false)]
  [string]$OutputDirectory = "infra/backups",

  [Parameter(Mandatory = $false)]
  [string]$Label = "pre-migration"
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump est introuvable. Installez PostgreSQL client et reessayez."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputFile = Join-Path $OutputDirectory "$Environment-$Label-$timestamp.dump"

Write-Host "Sauvegarde en cours vers: $outputFile"
& pg_dump "$ConnectionString" --format=custom --file="$outputFile"

if (-not (Test-Path -LiteralPath $outputFile)) {
  throw "Echec de creation de la sauvegarde: $outputFile"
}

Write-Host "Sauvegarde terminee: $outputFile"
Write-Output $outputFile
