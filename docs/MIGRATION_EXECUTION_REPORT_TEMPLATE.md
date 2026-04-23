# BuildFlow - Migration Execution Report Template

Ce document sert a tracer une execution de migration (dev/staging/prod).

## Metadonnees

- Date:
- Environnement: dev | staging | prod
- Operateur:
- Fenetre de maintenance:
- Reference ticket/changement:
- Snapshot/backup prealables:

## Sequence executee

Cocher chaque script et renseigner le resultat.

1. [ ] docs/migration-task-status-workflow.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

2. [ ] docs/migration-task-delete-guard.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

3. [ ] docs/migration-task-dependency-cycle-guard.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

4. [ ] docs/migration-task-dependency-rls-hardening.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

5. [ ] docs/migration-security-definer-search-path.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

6. [ ] docs/migration-security-definer-execute-privileges.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

7. [ ] docs/migration-security-definer-posture-checks.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

8. [ ] docs/migration-task-dependency-constraints-hardening.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

9. [ ] docs/migration-task-governance-posture-checks.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

10. [ ] docs/migration-release-gate-check.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

11. [ ] docs/migration-task-dependency-integrity-checks.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

12. [ ] docs/migration-task-dependency-smoke-tests.sql
- Start:
- End:
- Resultat: OK | KO
- Notes:

## Preflight et validations

- Preflight execute (docs/migration-task-dependency-preflight-report.sql): Oui | Non
- duplicate_pairs:
- self_dependencies:
- cross_project_dependencies:
- has_cycle:

- Release gate verdict: PASS | FAIL
- Integrite dependances: PASS | FAIL
- Smoke tests transactionnels: PASS | FAIL

## Incidents / Exceptions

- Description:
- Impact:
- Mitigation appliquee:
- Decision:

## Decision finale

- Go production: Oui | Non
- Approbateur:
- Date/heure approbation:

## Annexes

- Extraits logs SQL:
- Captures SQL Editor:
- Liens vers evidences:
