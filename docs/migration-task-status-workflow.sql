-- ===========================================
-- MIGRATION: Workflow strict de statut des tâches
-- ===========================================
-- Objectif:
-- 1) Empêcher les transitions de statut invalides côté base
-- 2) Réserver le passage à `done` aux rôles owner/admin/manager
-- 3) Maintenir automatiquement completed_at selon le statut

DROP TRIGGER IF EXISTS enforce_task_status_transition_trigger ON tasks;
DROP FUNCTION IF EXISTS enforce_task_status_transition() CASCADE;

CREATE OR REPLACE FUNCTION enforce_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
  project_id_value UUID;
  is_privileged BOOLEAN := FALSE;
BEGIN
  actor_id := auth.uid();
  project_id_value := COALESCE(NEW.project_id, OLD.project_id);

  -- Les opérations backend (service role / SQL editor) n'ont pas toujours auth.uid().
  -- On applique uniquement la cohérence completed_at dans ce cas.
  IF actor_id IS NULL THEN
    IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    ELSIF TG_OP = 'UPDATE' AND NEW.status <> 'done' AND OLD.status = 'done' THEN
      NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF project_id_value IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = project_id_value
        AND pm.user_id = actor_id
        AND pm.role IN ('owner', 'admin', 'manager')
    ) INTO is_privileged;
  ELSE
    is_privileged := (
      CASE
        WHEN TG_OP = 'INSERT' THEN NEW.created_by
        ELSE COALESCE(NEW.created_by, OLD.created_by)
      END
    ) = actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('todo', 'in-progress', 'review') THEN
      IF NOT (NEW.status = 'done' AND is_privileged) THEN
        RAISE EXCEPTION 'Statut initial invalide: %', NEW.status;
      END IF;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'todo' AND NEW.status = 'in-progress') OR
      (OLD.status = 'in-progress' AND NEW.status IN ('todo', 'review')) OR
      (OLD.status = 'review' AND NEW.status IN ('in-progress', 'done')) OR
      (OLD.status = 'done' AND NEW.status = 'review')
    ) THEN
      RAISE EXCEPTION 'Transition de statut invalide: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'done' AND NOT is_privileged THEN
      RAISE EXCEPTION 'Seuls owner/admin/manager peuvent passer une tâche à done';
    END IF;
  END IF;

  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_task_status_transition_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_status_transition();
