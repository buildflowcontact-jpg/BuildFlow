# Guide de migration

- Placez tous les scripts de migration dans `infra/migrations/`.
- Versionnez chaque migration (timestamp_nom.sql).
- Ne jamais supprimer une migration existante.
- Avant toute migration risquée, sauvegardez la base dans `infra/backups/`.
- Documentez chaque migration dans ce fichier ou dans le nom du script.
