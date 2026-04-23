param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionString,

  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore est introuvable. Installez PostgreSQL client et reessayez."
}

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Le fichier de sauvegarde n'existe pas: $BackupFile"
}

Write-Host "Restauration en cours depuis: $BackupFile"
& pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$ConnectionString" "$BackupFile"

Write-Host "Restauration terminée. Vérifiez l'intégrité des données."
