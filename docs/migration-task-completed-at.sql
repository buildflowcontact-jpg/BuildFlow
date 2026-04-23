-- ===========================================
-- MIGRATION: Ajout de completed_at sur tasks
-- ===========================================
-- Cette migration ajoute la colonne `completed_at` à la table `tasks`
-- pour tracer le moment où une tâche a été marquée comme terminée.
-- Exécutez ce script dans l'éditeur SQL de Supabase.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index pour faciliter les requêtes sur les tâches terminées récemment
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;
