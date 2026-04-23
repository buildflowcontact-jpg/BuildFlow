# Guide de restauration des données

## Étapes pour restaurer la base à partir d'une sauvegarde

1. **Vérifier le fichier de sauvegarde**
   - Le dump doit être dans `infra/backups/` et avoir l'extension `.dump`.

2. **Restaurer la base**
   - Utiliser le script PowerShell suivant :

```powershell
./scripts/sql/restore-database.ps1 -ConnectionString "<DB_URL>" -BackupFile "infra/backups/<nom-du-dump>.dump"
```

3. **Vérifier l'intégrité**
   - Contrôler que les tables et données sont bien présentes.
   - Tester l'application sur un environnement de test avant de restaurer en production.

## Précautions
- Ne jamais restaurer en prod sans validation sur un environnement de test.
- Toujours faire une sauvegarde de l’état actuel avant toute restauration.
