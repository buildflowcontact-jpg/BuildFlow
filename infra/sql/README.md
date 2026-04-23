# Scripts SQL utilitaires

Placez ici tous les scripts SQL non liés à une migration versionnée : audit, sécurité, requêtes d’analyse, etc.
---

## Stratégie de migrations incrémentales

### Principe : un fichier par changement

Chaque modification du schéma doit faire l'objet d'un **nouveau fichier de migration** plutôt que de modifier le fichier de setup initial.

```
supabase/migrations/
  20260415170000_full_app_setup.sql   ← setup initial (ne pas modifier)
  20260501120000_add_task_tags.sql    ← nouvelle migration
  20260510090000_add_expense_notes.sql
  ...
```

### Convention de nommage

```
YYYYMMDDHHMMSS_description_courte.sql
```

- Horodatage UTC au moment de la création (évite les conflits de merge)
- Description en snake_case, concise (max 5 mots)
- Exemples : `_add_column_status_reason`, `_create_notifications_table`, `_drop_legacy_activity_log`

### Règles

| Règle | Détail |
|---|---|
| **Idempotence** | Utiliser `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING` autant que possible |
| **Rollback explicite** | Inclure un commentaire `-- ROLLBACK:` avec la commande inverse en bas du fichier |
| **Jamais modifier le setup initial** | `20260415170000_full_app_setup.sql` est la référence immuable de production |
| **Un fichier = une responsabilité** | Regrouper les changements liés (table + RLS + trigger) en un seul fichier |
| **Pas de données** | Les migrations de schéma ne contiennent pas de données de seeds (sauf tables de référence) |

### Appliquer une migration localement

```bash
# Via Supabase CLI (recommandé)
supabase db push

# Ou directement via psql
psql "$DATABASE_URL" -f supabase/migrations/20260501120000_add_task_tags.sql
```

### Gate CI

Le workflow `sql-release-gate.yml` valide les migrations avant tout merge sur `main`.
Il exécute `docs/migration-release-gate-check.sql` pour vérifier l'absence de régressions RLS et de posture de sécurité.
