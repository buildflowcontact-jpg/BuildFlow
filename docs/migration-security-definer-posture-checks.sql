-- =====================================================
-- Verification de posture: fonctions SECURITY DEFINER
-- Date: 2026-04-15
-- Objectif: valider search_path et privileges EXECUTE
-- =====================================================

DO $$
DECLARE
  fn RECORD;
  missing_search_path_count INT := 0;
  public_execute_count INT := 0;
  unexpected_anon_execute_count INT := 0;
  helper_missing_authenticated_count INT := 0;
  helper_missing_service_role_count INT := 0;
  internal_non_service_role_count INT := 0;
BEGIN
  -- Fonctions critiques: helpers acces utilisateur + fonctions internes de trigger
  FOR fn IN
    SELECT *
    FROM (
      VALUES
        ('public.auth_is_project_member(uuid)'::regprocedure, 'helper'),
        ('public.auth_is_project_owner(uuid)'::regprocedure, 'helper'),
        ('public.add_project_creator_as_owner()'::regprocedure, 'internal'),
        ('public.enforce_task_status_transition()'::regprocedure, 'internal'),
        ('public.enforce_task_dependency_no_cycles()'::regprocedure, 'internal'),
        ('public.enforce_task_delete_guard()'::regprocedure, 'internal'),
        ('public.audit_trigger_function()'::regprocedure, 'internal'),
        ('public.update_task_actual_hours()'::regprocedure, 'internal')
    ) AS t(fn_oid, fn_kind)
  LOOP
    -- 1) search_path fixe a public
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.oid = fn.fn_oid
        AND n.nspname = 'public'
        AND array_to_string(COALESCE(p.proconfig, ARRAY[]::text[]), ',') LIKE '%search_path=public%'
    ) THEN
      missing_search_path_count := missing_search_path_count + 1;
    END IF;

    -- 2) PUBLIC ne doit pas avoir EXECUTE
    IF has_function_privilege('public', fn.fn_oid, 'EXECUTE') THEN
      public_execute_count := public_execute_count + 1;
    END IF;

    -- 3) anon ne doit pas avoir EXECUTE
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND has_function_privilege('anon', fn.fn_oid, 'EXECUTE') THEN
      unexpected_anon_execute_count := unexpected_anon_execute_count + 1;
    END IF;

    IF fn.fn_kind = 'helper' THEN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
         AND NOT has_function_privilege('authenticated', fn.fn_oid, 'EXECUTE') THEN
        helper_missing_authenticated_count := helper_missing_authenticated_count + 1;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
         AND NOT has_function_privilege('service_role', fn.fn_oid, 'EXECUTE') THEN
        helper_missing_service_role_count := helper_missing_service_role_count + 1;
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
         AND has_function_privilege('authenticated', fn.fn_oid, 'EXECUTE') THEN
        internal_non_service_role_count := internal_non_service_role_count + 1;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
         AND NOT has_function_privilege('service_role', fn.fn_oid, 'EXECUTE') THEN
        internal_non_service_role_count := internal_non_service_role_count + 1;
      END IF;
    END IF;
  END LOOP;

  IF missing_search_path_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % fonction(s) critique(s) sans search_path=public', missing_search_path_count;
  END IF;

  IF public_execute_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % fonction(s) critique(s) exposent EXECUTE a PUBLIC', public_execute_count;
  END IF;

  IF unexpected_anon_execute_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % fonction(s) critique(s) exposent EXECUTE a anon', unexpected_anon_execute_count;
  END IF;

  IF helper_missing_authenticated_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % helper(s) sans EXECUTE pour authenticated', helper_missing_authenticated_count;
  END IF;

  IF helper_missing_service_role_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: % helper(s) sans EXECUTE pour service_role', helper_missing_service_role_count;
  END IF;

  IF internal_non_service_role_count > 0 THEN
    RAISE EXCEPTION 'Posture FAILED: privileges invalides sur fonctions internes trigger (% cas)', internal_non_service_role_count;
  END IF;

  RAISE NOTICE 'OK posture SECURITY DEFINER: search_path et privileges EXECUTE conformes.';
END $$;
