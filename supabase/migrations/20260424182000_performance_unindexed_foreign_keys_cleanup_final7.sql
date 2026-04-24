-- 20260424182000_performance_unindexed_foreign_keys_cleanup_final7.sql
-- Objectif : couvrir les 4 dernières FK signalées par l'advisor

CREATE INDEX IF NOT EXISTS virtual_members_source_favorite_id_fkey_idx ON public.virtual_members (source_favorite_id);
CREATE INDEX IF NOT EXISTS worker_qualifications_created_by_fkey_idx ON public.worker_qualifications (created_by);
CREATE INDEX IF NOT EXISTS worker_qualifications_project_id_fkey_idx ON public.worker_qualifications (project_id);
CREATE INDEX IF NOT EXISTS worker_qualifications_subcontractor_id_fkey_idx ON public.worker_qualifications (subcontractor_id);
