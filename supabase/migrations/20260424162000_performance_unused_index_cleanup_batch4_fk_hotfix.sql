-- Restore FK covering indexes reintroduced by batch4 cleanup
CREATE INDEX IF NOT EXISTS automation_rules_project_idx ON public.automation_rules(project_id);
CREATE INDEX IF NOT EXISTS decision_journal_project_idx ON public.decision_journal(project_id);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS project_baselines_project_idx ON public.project_baselines(project_id);
