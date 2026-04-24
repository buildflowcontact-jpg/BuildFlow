-- 20260424180000_performance_unindexed_foreign_keys_cleanup_final5.sql
-- Objectif : couvrir les 4 dernières FK signalées par l'advisor

CREATE INDEX IF NOT EXISTS task_milestone_mapping_milestone_id_fkey_idx ON public.task_milestone_mapping (milestone_id);
CREATE INDEX IF NOT EXISTS task_templates_project_id_fkey_idx ON public.task_templates (project_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_fkey_idx ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_created_by_fkey_idx ON public.tasks (created_by);
