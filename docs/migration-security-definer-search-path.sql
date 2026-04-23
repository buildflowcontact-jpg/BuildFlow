-- =====================================================
-- Migration: durcissement SECURITY DEFINER (search_path)
-- Date: 2026-04-15
-- Objectif: fixer search_path=public sur les fonctions critiques
-- =====================================================

ALTER FUNCTION auth_is_project_member(UUID) SET search_path = public;
ALTER FUNCTION auth_is_project_owner(UUID) SET search_path = public;
ALTER FUNCTION add_project_creator_as_owner() SET search_path = public;
ALTER FUNCTION enforce_task_status_transition() SET search_path = public;
ALTER FUNCTION enforce_task_dependency_no_cycles() SET search_path = public;
ALTER FUNCTION enforce_task_delete_guard() SET search_path = public;
ALTER FUNCTION audit_trigger_function() SET search_path = public;
ALTER FUNCTION update_task_actual_hours() SET search_path = public;
