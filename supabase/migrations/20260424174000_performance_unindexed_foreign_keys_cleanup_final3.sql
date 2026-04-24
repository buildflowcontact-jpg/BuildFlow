-- 20260424174000_performance_unindexed_foreign_keys_cleanup_final3.sql
-- Objectif : couvrir les 4 dernières FK signalées par l'advisor

CREATE INDEX IF NOT EXISTS sla_violations_task_id_fkey_idx ON public.sla_violations (task_id);
CREATE INDEX IF NOT EXISTS subtasks_task_id_fkey_idx ON public.subtasks (task_id);
CREATE INDEX IF NOT EXISTS supply_orders_created_by_fkey_idx ON public.supply_orders (created_by);
CREATE INDEX IF NOT EXISTS supply_orders_project_id_fkey_idx ON public.supply_orders (project_id);
