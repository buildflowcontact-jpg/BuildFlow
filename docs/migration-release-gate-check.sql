-- =====================================================
-- Release gate: controle global de posture SQL
-- Date: 2026-04-15
-- Objectif: echouer si la posture cible n'est pas atteinte
-- =====================================================

DO $$
DECLARE
  failure_count INT := 0;
BEGIN
  -- 1) RLS actif sur tables critiques
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tasks'
      AND c.relrowsecurity = TRUE
  ) THEN
    failure_count := failure_count + 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'task_dependencies'
      AND c.relrowsecurity = TRUE
  ) THEN
    failure_count := failure_count + 1;
  END IF;

  -- 2) Policies RLS critiques sur task_dependencies
  IF (
    SELECT COUNT(*)
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
    )
  ) > 0 THEN
    failure_count := failure_count + 1;
  END IF;

  -- 3) Triggers metier critiques
  IF (
    SELECT COUNT(*)
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
    )
  ) > 0 THEN
    failure_count := failure_count + 1;
  END IF;

  -- 4) Contraintes critiques task_dependencies
  IF (
    SELECT COUNT(*)
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
    )
  ) > 0 THEN
    failure_count := failure_count + 1;
  END IF;

  -- 5) search_path sur fonctions SECURITY DEFINER critiques
  IF (
    SELECT COUNT(*)
    FROM (
      VALUES
        ('public.auth_is_project_member(uuid)'::regprocedure),
        ('public.auth_is_project_owner(uuid)'::regprocedure),
        ('public.add_project_creator_as_owner()'::regprocedure),
        ('public.enforce_task_status_transition()'::regprocedure),
        ('public.enforce_task_dependency_no_cycles()'::regprocedure),
        ('public.enforce_task_delete_guard()'::regprocedure),
        ('public.audit_trigger_function()'::regprocedure),
        ('public.update_task_actual_hours()'::regprocedure)
    ) AS f(fn_oid)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.oid = f.fn_oid
        AND n.nspname = 'public'
        AND array_to_string(COALESCE(p.proconfig, ARRAY[]::text[]), ',') LIKE '%search_path=public%'
    )
  ) > 0 THEN
    failure_count := failure_count + 1;
  END IF;

  -- 6) Privileges EXECUTE attendus
  IF (
    SELECT COUNT(*)
    FROM (
      VALUES
        ('public.auth_is_project_member(uuid)'::regprocedure, 'helper'::text),
        ('public.auth_is_project_owner(uuid)'::regprocedure, 'helper'::text),
        ('public.add_project_creator_as_owner()'::regprocedure, 'internal'::text),
        ('public.enforce_task_status_transition()'::regprocedure, 'internal'::text),
        ('public.enforce_task_dependency_no_cycles()'::regprocedure, 'internal'::text),
        ('public.enforce_task_delete_guard()'::regprocedure, 'internal'::text),
        ('public.audit_trigger_function()'::regprocedure, 'internal'::text),
        ('public.update_task_actual_hours()'::regprocedure, 'internal'::text)
    ) AS f(fn_oid, fn_kind)
    WHERE
      has_function_privilege('public', f.fn_oid, 'EXECUTE')
      OR (
        EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
        AND has_function_privilege('anon', f.fn_oid, 'EXECUTE')
      )
      OR (
        f.fn_kind = 'helper'
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        AND NOT has_function_privilege('authenticated', f.fn_oid, 'EXECUTE')
      )
      OR (
        f.fn_kind = 'helper'
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        AND NOT has_function_privilege('service_role', f.fn_oid, 'EXECUTE')
      )
      OR (
        f.fn_kind = 'internal'
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
        AND has_function_privilege('authenticated', f.fn_oid, 'EXECUTE')
      )
      OR (
        f.fn_kind = 'internal'
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
        AND NOT has_function_privilege('service_role', f.fn_oid, 'EXECUTE')
      )
  ) > 0 THEN
    failure_count := failure_count + 1;
  END IF;

  -- 7) Ownership des fonctions SECURITY DEFINER critiques
  -- Les fonctions critiques ne doivent pas appartenir a anon/authenticated.
  IF (
    SELECT COUNT(*)
    FROM (
      VALUES
        ('public.auth_is_project_member(uuid)'::regprocedure),
        ('public.auth_is_project_owner(uuid)'::regprocedure),
        ('public.add_project_creator_as_owner()'::regprocedure),
        ('public.enforce_task_status_transition()'::regprocedure),
        ('public.enforce_task_dependency_no_cycles()'::regprocedure),
        ('public.enforce_task_delete_guard()'::regprocedure),
        ('public.audit_trigger_function()'::regprocedure),
        ('public.update_task_actual_hours()'::regprocedure)
    ) AS f(fn_oid)
    JOIN pg_proc p ON p.oid = f.fn_oid
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE r.rolname IN ('anon', 'authenticated')
  ) > 0 THEN
    failure_count := failure_count + 1;
  END IF;

  IF failure_count > 0 THEN
    RAISE EXCEPTION 'Release gate FAILED: % bloc(s) de controle non conformes', failure_count;
  END IF;

  RAISE NOTICE 'Release gate OK: posture SQL conforme pour deploiement.';
END $$;
