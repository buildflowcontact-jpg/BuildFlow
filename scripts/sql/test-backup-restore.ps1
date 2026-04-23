param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionString,

    [Parameter(Mandatory = $false)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev'
)

# Test automatisé d'intégrité backup/restore
# 1. Crée un dump temporaire
# 2. Restaure ce dump dans la base cible de test
# 3. Nettoie systématiquement les artefacts temporaires

$ErrorActionPreference = 'Stop'

$backupScript = Join-Path $PSScriptRoot 'backup-database.ps1'
$restoreScript = Join-Path $PSScriptRoot 'restore-database.ps1'
$outputDirectory = 'infra/backups'
$backupPath = $null

try {
    Write-Host "[TEST] Lancement du backup de test..."
    $backupPath = & $backupScript -ConnectionString $ConnectionString -Environment $Environment -OutputDirectory $outputDirectory -Label 'ci-backup-restore-test'

    if (-not $backupPath -or -not (Test-Path -LiteralPath $backupPath)) {
        throw "Le dump temporaire n'a pas ete cree."
    }
    Write-Host "[TEST] Dump créé avec succès: $backupPath"

    Write-Host "[TEST] Lancement de la restauration de test..."
    & $restoreScript -ConnectionString $ConnectionString -BackupFile $backupPath

    Write-Host "[TEST] Test backup/restore terminé avec succès."
}
finally {
    if ($backupPath -and (Test-Path -LiteralPath $backupPath)) {
        Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
        Write-Host "[CLEANUP] Dump temporaire supprimé: $backupPath"
    }
}
