-- Batch 2 (conservative): drop non-FK unused indexes on status/date/condition dimensions
DROP INDEX IF EXISTS public.decision_journal_created_date_idx;
DROP INDEX IF EXISTS public.decision_journal_status_idx;
DROP INDEX IF EXISTS public.milestones_status_idx;
DROP INDEX IF EXISTS public.milestones_target_date_idx;
DROP INDEX IF EXISTS public.project_baselines_date_idx;
DROP INDEX IF EXISTS public.recurrent_tasks_next_occurrence_idx;
DROP INDEX IF EXISTS public.sla_rules_condition_idx;
DROP INDEX IF EXISTS public.tasks_end_date_idx;
DROP INDEX IF EXISTS public.tasks_status_idx;
DROP INDEX IF EXISTS public.time_entries_date_idx;
