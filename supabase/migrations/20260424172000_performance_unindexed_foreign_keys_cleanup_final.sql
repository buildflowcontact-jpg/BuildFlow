-- 20260424172000_performance_unindexed_foreign_keys_cleanup_final.sql
-- Objectif : couvrir toutes les dernières FK signalées par l'advisor (site_incidents, site_journal_entries, site_photos, site_zones)

CREATE INDEX IF NOT EXISTS site_incidents_subcontractor_id_fkey_idx ON public.site_incidents (subcontractor_id);
CREATE INDEX IF NOT EXISTS site_incidents_zone_id_fkey_idx ON public.site_incidents (zone_id);
CREATE INDEX IF NOT EXISTS site_journal_entries_created_by_fkey_idx ON public.site_journal_entries (created_by);
CREATE INDEX IF NOT EXISTS site_journal_entries_project_id_fkey_idx ON public.site_journal_entries (project_id);
CREATE INDEX IF NOT EXISTS site_journal_entries_subcontractor_id_fkey_idx ON public.site_journal_entries (subcontractor_id);
CREATE INDEX IF NOT EXISTS site_journal_entries_zone_id_fkey_idx ON public.site_journal_entries (zone_id);
CREATE INDEX IF NOT EXISTS site_photos_uploaded_by_fkey_idx ON public.site_photos (uploaded_by);
CREATE INDEX IF NOT EXISTS site_zones_created_by_fkey_idx ON public.site_zones (created_by);
CREATE INDEX IF NOT EXISTS site_zones_parent_zone_id_fkey_idx ON public.site_zones (parent_zone_id);
