-- 20260424175000_performance_unindexed_foreign_keys_cleanup_final4.sql
-- Objectif : couvrir les 4 dernières FK signalées par l'advisor

CREATE INDEX IF NOT EXISTS supply_orders_subcontractor_id_fkey_idx ON public.supply_orders (subcontractor_id);
CREATE INDEX IF NOT EXISTS supply_orders_zone_id_fkey_idx ON public.supply_orders (zone_id);
CREATE INDEX IF NOT EXISTS task_assignees_user_id_fkey_idx ON public.task_assignees (user_id);
CREATE INDEX IF NOT EXISTS task_dependencies_target_task_id_fkey_idx ON public.task_dependencies (target_task_id);
