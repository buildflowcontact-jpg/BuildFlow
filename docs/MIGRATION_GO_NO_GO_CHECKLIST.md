# BuildFlow - Migration Go/No-Go Checklist

Checklist rapide avant execution en production.

## Avant fenetre

1. [ ] Snapshot/backup valide et teste.
2. [ ] Ordre des scripts confirme depuis docs/MIGRATION_RUNBOOK.md.
3. [ ] Operateur et reviewer identifies.
4. [ ] Fenetre de maintenance communiquee.
5. [ ] Plan de rollback valide.

## Go criteria (obligatoires)

1. [ ] Tous les scripts de migration executes sans erreur bloquante.
2. [ ] docs/migration-security-definer-posture-checks.sql: PASS.
3. [ ] docs/migration-task-governance-posture-checks.sql: PASS.
4. [ ] docs/migration-release-gate-check.sql: PASS.
5. [ ] docs/migration-task-dependency-integrity-checks.sql: PASS.
6. [ ] docs/migration-task-dependency-smoke-tests.sql: PASS.

## No-Go criteria (bloquants)

1. [ ] Un script de posture/integrite/release gate echoue.
2. [ ] Donnees incoherentes non corrigees (cycles, inter-projets, auto-dependances).
3. [ ] Absence de rollback praticable.
4. [ ] Ecart de privileges SECURITY DEFINER non resolu.

## Decision

- Decision: GO | NO-GO
- Responsable decision:
- Date/heure:
- Commentaires:
