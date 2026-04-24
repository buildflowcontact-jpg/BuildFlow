-- 20260424173000_performance_unindexed_foreign_keys_cleanup_final2.sql
-- Objectif : couvrir les 4 dernières FK signalées par l'advisor

CREATE INDEX IF NOT EXISTS site_zones_project_id_fkey_idx ON public.site_zones (project_id);
CREATE INDEX IF NOT EXISTS sla_rules_created_by_fkey_idx ON public.sla_rules (created_by);
CREATE INDEX IF NOT EXISTS sla_rules_project_id_fkey_idx ON public.sla_rules (project_id);
CREATE INDEX IF NOT EXISTS sla_violations_sla_rule_id_fkey_idx ON public.sla_violations (sla_rule_id);
