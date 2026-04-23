-- ===========================================
-- MIGRATION: Garde-fou suppression des tâches
-- ===========================================
-- Objectif:
-- 1) Empêcher la suppression directe d'une tâche parent
-- 2) Empêcher la suppression directe d'une tâche ayant des dépendances
-- 3) Laisser passer la suppression en cascade lors de la suppression d'un projet

DROP TRIGGER IF EXISTS enforce_task_delete_guard_trigger ON tasks;
DROP FUNCTION IF EXISTS enforce_task_delete_guard() CASCADE;

CREATE OR REPLACE FUNCTION enforce_task_delete_guard()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
  project_still_exists BOOLEAN := TRUE;
BEGIN
  actor_id := auth.uid();

  -- Exécution backend/service role: ne pas bloquer.
  IF actor_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = OLD.project_id
  ) INTO project_still_exists;

  -- Si le projet est en cours de suppression, on autorise la cascade.
  IF NOT project_still_exists THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tasks child
    WHERE child.parent_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Suppression bloquee: cette tache contient des sous-taches';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM task_dependencies td
    WHERE td.source_task_id = OLD.id
       OR td.target_task_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Suppression bloquee: retirez d''abord les dependances de la tache';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_task_delete_guard_trigger
  BEFORE DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_delete_guard();
