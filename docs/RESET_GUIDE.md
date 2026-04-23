# BuildFlow - Guide SQL unique

Deux scripts SQL sont disponibles:

- `docs/full-app-setup.sql` (recommande pour reset complet + reinstall)
- `docs/supabase-setup.sql` (script principal equivalent)

Ce script fait tout en une execution:

1. nettoyage complet des objets applicatifs (tables, triggers, fonctions)
2. recreation complete du schema BuildFlow
3. activation RLS
4. creation des fonctions de securite
5. creation des triggers, index et policies

## Execution dans Supabase SQL Editor

1. Ouvrir https://app.supabase.com
2. Selectionner le projet
3. Aller dans SQL Editor
4. Creer une nouvelle requete
5. Copier-coller tout le contenu de `docs/full-app-setup.sql`
6. Executer

## Important

- Utiliser ce script uniquement en developpement ou environnement de test.
- Ne pas executer sur une base de production avec des donnees critiques.
- Le script est idempotent au sens reset/recreate, mais il supprime les donnees applicatives existantes.

## Verification rapide

Apres execution, verifier dans Supabase que les tables principales existent:

- `projects`
- `tasks`
- `documents`
- `project_members`
- `risk_register`
- `automation_rules`

## Etape suivante cote application

```bash
cd frontend
npm run dev
```

## Runbook migration incremental

Pour les environnements existants (sans reset), suivre l'ordre d'execution de:

- docs/MIGRATION_RUNBOOK.md
