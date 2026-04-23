# Structure du dossier infra

Ce dossier contient tout ce qui concerne l’infrastructure, la base de données, les scripts SQL, les migrations et les sauvegardes.

- `migrations/` : Scripts de migration versionnés (exécution contrôlée, jamais supprimés automatiquement).
- `sql/` : Scripts SQL utilitaires, requêtes d’audit, sécurité, etc.
- `backups/` : Sauvegardes manuelles ou automatiques de la base ou des fichiers.

⚠️ Ne jamais supprimer ce dossier lors d’un nettoyage du code applicatif.

Pour toute opération risquée (reset, migration, suppression), sauvegarder d’abord les données ici.