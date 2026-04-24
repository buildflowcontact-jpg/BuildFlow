-- 20260424181000_performance_unindexed_foreign_keys_cleanup_final6.sql
-- Objectif : couvrir les 4 dernières FK signalées par l'advisor

CREATE INDEX IF NOT EXISTS tasks_parent_id_fkey_idx ON public.tasks (parent_id);
CREATE INDEX IF NOT EXISTS team_capacity_user_id_fkey_idx ON public.team_capacity (user_id);
CREATE INDEX IF NOT EXISTS time_entries_task_id_fkey_idx ON public.time_entries (task_id);
CREATE INDEX IF NOT EXISTS virtual_members_project_id_fkey_idx ON public.virtual_members (project_id);
