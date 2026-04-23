-- ===========================================
-- MIGRATION: Ajout de completed_at sur tasks
-- ===========================================
-- Ajoute completed_at pour tracer le moment où une tâche est marquée done.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;
