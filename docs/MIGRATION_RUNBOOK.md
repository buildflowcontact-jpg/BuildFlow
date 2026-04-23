# BuildFlow - Migration Runbook (Dev / Staging / Prod)

Ce runbook decrit l'ordre d'execution des migrations SQL de securisation et les verifications associees.

## Portee

- Migrations de regles metier taches/dependances
- Durcissement RLS
- Durcissement SECURITY DEFINER (search_path + privileges)
- Verification d'integrite et smoke tests

## Pre-requis

1. Avoir un snapshot/backup de la base cible.
2. Executer d'abord en dev, puis staging, puis prod.
3. Utiliser un compte avec droits SQL suffisants (owner/service_role).

## Preflight (recommande)

1. Executer docs/migration-task-dependency-preflight-report.sql.
2. Noter les compteurs: duplicate_pairs, self_dependencies, cross_project_dependencies, has_cycle.
3. Garder la sortie comme reference avant migration.

## Ordre d'execution recommande

1. docs/migration-task-status-workflow.sql
2. docs/migration-task-delete-guard.sql
3. docs/migration-task-dependency-cycle-guard.sql
4. docs/migration-task-dependency-rls-hardening.sql
5. docs/migration-security-definer-search-path.sql
6. docs/migration-security-definer-execute-privileges.sql
7. docs/migration-security-definer-posture-checks.sql
8. docs/migration-task-dependency-constraints-hardening.sql
9. docs/migration-task-governance-posture-checks.sql
10. docs/migration-release-gate-check.sql
11. docs/migration-task-dependency-integrity-checks.sql
12. docs/migration-task-dependency-smoke-tests.sql

## Resultat attendu par etape

1. Status workflow: transitions invalides bloquees, done reserve aux roles privilegies.
2. Delete guard: suppression directe de tache parent/dependante bloquee.
3. Dependency cycle guard: cycles et liens inter-projets bloques; doublons nettoyes puis unicite garantie.
4. RLS hardening: controles source+cible sur creation/mise a jour des dependances.
5. SECURITY DEFINER search_path: search_path fixe a public.
6. SECURITY DEFINER privileges: EXECUTE revoke de PUBLIC, grants minimaux.
7. SECURITY DEFINER posture checks: doit retourner un NOTICE OK, sinon exception.
8. Dependency constraints hardening: auto-dependances et doublons nettoyes, contraintes garanties.
9. Governance posture checks: policies/triggers/contraintes/index critiques verifies.
10. Release gate check: verification globale de posture SQL en un seul PASS/FAIL.
11. Integrity checks: doit retourner un NOTICE OK, sinon exception.
12. Smoke tests: doit finir en succes avec ROLLBACK (aucune donnee persistante).

## Checklist de validation apres execution

1. Les migrations s'executent sans erreur bloquante.
2. Aucune dependance inter-projets residuelle.
3. Aucun cycle de dependances detecte.
4. Les policies task_dependencies incluent SELECT/INSERT/UPDATE/DELETE attendues.
5. Les fonctions critiques ont search_path = public.
6. Les fonctions critiques n'ont pas de privilege PUBLIC.
7. Les fonctions SECURITY DEFINER critiques ne sont pas owner par anon/authenticated.

## Rollback / Mitigation

1. En cas d'echec avant prod: restaurer le backup/snapshot et corriger le script en dev.
2. En prod sans corruption de donnees: appliquer une migration corrective incrementale (ne pas reset).
3. En prod avec corruption de donnees: basculer sur snapshot precedent puis rejouer la sequence corrigee.

## Notes d'exploitation

- Ne pas executer docs/full-app-setup.sql ou docs/supabase-setup.sql en production: ces scripts font un reset complet.
- Les scripts d'integrite/smoke sont des garde-fous de validation; les conserver dans la procedure de release.
- Utiliser docs/MIGRATION_EXECUTION_REPORT_TEMPLATE.md pour tracer chaque execution.
- Utiliser docs/MIGRATION_GO_NO_GO_CHECKLIST.md pour la decision finale avant prod.
- Pour execution automatisee locale: scripts/sql/run-migration-sequence.ps1.
- Pour controle CI manuel: .github/workflows/sql-release-gate.yml.
- Pour validation UI des erreurs SQL: docs/FRONT_SQL_ERROR_TEST_SCENARIOS.md.
