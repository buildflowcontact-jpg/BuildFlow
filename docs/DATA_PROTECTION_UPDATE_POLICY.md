# Politique de protection des donnees pendant les mises a jour

Objectif: garantir qu'une mise a jour applicative ne provoque pas de perte de donnees utilisateurs.

## Principe d'architecture

- Le code applicatif evolue independamment des donnees stockees.
- Les donnees vivent dans PostgreSQL/Supabase et Supabase Storage, hors build frontend.
- Les mises a jour passent uniquement par des migrations versionnees et tracables.

## Procédures obligatoires

### 1. Faire une sauvegarde :

PowerShell:

./scripts/sql/backup-database.ps1 -ConnectionString "<DB_URL>" -Environment prod

### 2. Executer les migrations avec référence de sauvegarde :
### 3. Restaurer les données (en cas de besoin) :

```powershell
./scripts/sql/restore-database.ps1 -ConnectionString "<DB_URL>" -BackupFile "infra/backups/<nom-du-dump>.dump"
```

Voir aussi : infra/restore-guide.md

PowerShell:

./scripts/sql/run-migration-sequence.ps1 -ConnectionString "<DB_URL>" -Environment prod -BackupPath "infra/backups/prod-pre-migration-YYYYMMDD-HHMMSS.dump"

## Regles de securite

- En production, une migration sans parametre BackupPath est refusee.
- Le fichier de sauvegarde doit exister localement au moment du lancement.
- Les scripts de reset ne doivent jamais etre executes en production.

## Bonnes pratiques de separation code/donnees

- Ne jamais stocker les donnees utilisateurs dans le repo code.
- Utiliser des variables d'environnement distinctes dev/staging/prod.
- Interdire l'utilisation des credentials prod en environnement dev local.
- Conserver les sauvegardes dans infra/backups avec rotation reguliere.
