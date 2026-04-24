-- Batch 4 (minimal risk): drop additional non-FK unused project helper indexes
DROP INDEX IF EXISTS public.automation_rules_project_idx;
DROP INDEX IF EXISTS public.decision_journal_project_idx;
DROP INDEX IF EXISTS public.milestones_project_idx;
DROP INDEX IF EXISTS public.project_baselines_project_idx;
