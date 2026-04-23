-- =====================================================
-- Migration: privilèges EXECUTE sur fonctions critiques
-- Date: 2026-04-15
-- Objectif: retirer EXECUTE global et limiter aux rôles utiles
-- =====================================================

REVOKE ALL ON FUNCTION auth_is_project_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_is_project_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_project_creator_as_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_task_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_task_dependency_no_cycles() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_task_delete_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_trigger_function() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_task_actual_hours() FROM PUBLIC;

REVOKE ALL ON FUNCTION auth_is_project_member(UUID) FROM anon;
REVOKE ALL ON FUNCTION auth_is_project_owner(UUID) FROM anon;
REVOKE ALL ON FUNCTION add_project_creator_as_owner() FROM anon;
REVOKE ALL ON FUNCTION enforce_task_status_transition() FROM anon;
REVOKE ALL ON FUNCTION enforce_task_dependency_no_cycles() FROM anon;
REVOKE ALL ON FUNCTION enforce_task_delete_guard() FROM anon;
REVOKE ALL ON FUNCTION audit_trigger_function() FROM anon;
REVOKE ALL ON FUNCTION update_task_actual_hours() FROM anon;

REVOKE ALL ON FUNCTION add_project_creator_as_owner() FROM authenticated;
REVOKE ALL ON FUNCTION enforce_task_status_transition() FROM authenticated;
REVOKE ALL ON FUNCTION enforce_task_dependency_no_cycles() FROM authenticated;
REVOKE ALL ON FUNCTION enforce_task_delete_guard() FROM authenticated;
REVOKE ALL ON FUNCTION audit_trigger_function() FROM authenticated;
REVOKE ALL ON FUNCTION update_task_actual_hours() FROM authenticated;

GRANT EXECUTE ON FUNCTION auth_is_project_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_is_project_owner(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_project_creator_as_owner() TO service_role;
GRANT EXECUTE ON FUNCTION enforce_task_status_transition() TO service_role;
GRANT EXECUTE ON FUNCTION enforce_task_dependency_no_cycles() TO service_role;
GRANT EXECUTE ON FUNCTION enforce_task_delete_guard() TO service_role;
GRANT EXECUTE ON FUNCTION audit_trigger_function() TO service_role;
GRANT EXECUTE ON FUNCTION update_task_actual_hours() TO service_role;
