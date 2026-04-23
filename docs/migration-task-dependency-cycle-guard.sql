-- ===========================================
-- MIGRATION: Anti-cycle dépendances de tâches
-- ===========================================
-- Objectif:
-- 1) Empêcher les cycles dans task_dependencies
-- 2) Empêcher les liens dupliqués source->target

-- Nettoyer les éventuels doublons avant index unique
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source_task_id, target_task_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM task_dependencies
)
DELETE FROM task_dependencies td
USING ranked r
WHERE td.id = r.id
  AND r.rn > 1;

-- Nettoyer les dépendances inter-projets (incohérentes)
DELETE FROM task_dependencies td
USING tasks source_task, tasks target_task
WHERE source_task.id = td.source_task_id
  AND target_task.id = td.target_task_id
  AND source_task.project_id IS DISTINCT FROM target_task.project_id;

CREATE UNIQUE INDEX IF NOT EXISTS task_dependencies_source_target_idx
  ON task_dependencies(source_task_id, target_task_id);

DROP TRIGGER IF EXISTS enforce_task_dependency_no_cycles_trigger ON task_dependencies;
DROP FUNCTION IF EXISTS enforce_task_dependency_no_cycles() CASCADE;

CREATE OR REPLACE FUNCTION enforce_task_dependency_no_cycles()
RETURNS TRIGGER AS $$
DECLARE
  source_project_id UUID;
  target_project_id UUID;
  creates_cycle BOOLEAN := FALSE;
BEGIN
  IF NEW.source_task_id = NEW.target_task_id THEN
    RAISE EXCEPTION 'Cycle de dépendance interdit: une tâche ne peut pas dépendre d''elle-même';
  END IF;

  SELECT t.project_id INTO source_project_id
  FROM tasks t
  WHERE t.id = NEW.source_task_id;

  SELECT t.project_id INTO target_project_id
  FROM tasks t
  WHERE t.id = NEW.target_task_id;

  IF source_project_id IS NULL OR target_project_id IS NULL OR source_project_id <> target_project_id THEN
    RAISE EXCEPTION 'Dépendance invalide: source et cible doivent appartenir au même projet';
  END IF;

  WITH RECURSIVE downstream(task_id) AS (
    SELECT td.target_task_id
    FROM task_dependencies td
    WHERE td.source_task_id = NEW.target_task_id
      AND (TG_OP = 'INSERT' OR td.id <> NEW.id)
    UNION
    SELECT td.target_task_id
    FROM task_dependencies td
    INNER JOIN downstream d ON td.source_task_id = d.task_id
    WHERE (TG_OP = 'INSERT' OR td.id <> NEW.id)
  )
  SELECT EXISTS (
    SELECT 1
    FROM downstream
    WHERE task_id = NEW.source_task_id
  ) INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION 'Cycle de dépendance interdit: % -> % crée une boucle', NEW.source_task_id, NEW.target_task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_task_dependency_no_cycles_trigger
  BEFORE INSERT OR UPDATE ON task_dependencies
  FOR EACH ROW EXECUTE FUNCTION enforce_task_dependency_no_cycles();
