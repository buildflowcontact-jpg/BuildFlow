-- =====================================================
-- Verification de posture: gouvernance taches/dependances
-- Date: 2026-04-15
-- Objectif: verifier policies, triggers, contraintes et index critiques
-- =====================================================

DO $$
DECLARE
  missing_policies_count INT := 0;
  missing_triggers_count INT := 0;
  missing_constraints_count INT := 0;
  missing_indexes_count INT := 0;
BEGIN
  -- 1) Policies RLS critiques sur task_dependencies
  SELECT COUNT(*) INTO missing_policies_count
  FROM (
    SELECT 'Users can view dependencies of accessible tasks'::text AS policy_name, 'SELECT'::text AS cmd
    UNION ALL SELECT 'Users can create dependencies', 'INSERT'
    UNION ALL SELECT 'Users can update dependencies', 'UPDATE'
    UNION ALL SELECT 'Users can delete dependencies', 'DELETE'
  ) expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'task_dependencies'
      AND p.policyname = expected.policy_name
      AND p.cmd = expected.cmd
  );

  IF missing_policies_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % policy/policies RLS manquante(s) sur task_dependencies', missing_policies_count;
  END IF;

  -- 2) Triggers metier critiques
  SELECT COUNT(*) INTO missing_triggers_count
  FROM (
    SELECT 'tasks'::text AS table_name, 'enforce_task_status_transition_trigger'::text AS trigger_name
    UNION ALL SELECT 'tasks', 'enforce_task_delete_guard_trigger'
    UNION ALL SELECT 'task_dependencies', 'enforce_task_dependency_no_cycles_trigger'
  ) expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = expected.table_name
      AND t.tgname = expected.trigger_name
      AND NOT t.tgisinternal
  );

  IF missing_triggers_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % trigger(s) metier critique(s) manquant(s)', missing_triggers_count;
  END IF;

  -- 3) Contraintes critiques sur task_dependencies
  SELECT COUNT(*) INTO missing_constraints_count
  FROM (
    SELECT 'no_self_dependency'::text AS constraint_name
    UNION ALL SELECT 'unique_task_dependency_link'
  ) expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'task_dependencies'
      AND con.conname = expected.constraint_name
  );

  IF missing_constraints_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % contrainte(s) critique(s) manquante(s) sur task_dependencies', missing_constraints_count;
  END IF;

  -- 4) Index critiques pour parcourir le graphe de dependances
  SELECT COUNT(*) INTO missing_indexes_count
  FROM (
    SELECT 'task_dependencies_source_idx'::text AS index_name
    UNION ALL SELECT 'task_dependencies_target_idx'
  ) expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename = 'task_dependencies'
      AND i.indexname = expected.index_name
  );

  IF missing_indexes_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % index critiques manquants sur task_dependencies', missing_indexes_count;
  END IF;

  RAISE NOTICE 'OK posture gouvernance taches/dependances: policies, triggers, contraintes et index conformes.';
END $$;
