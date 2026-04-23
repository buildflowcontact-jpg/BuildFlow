-- =====================================================
-- Smoke tests: task_dependencies (non destructif)
-- Date: 2026-04-15
-- Usage: exécuter après les migrations de durcissement
-- Note: ce script termine par ROLLBACK pour ne rien persister
-- =====================================================

BEGIN;

DO $$
DECLARE
  p1 UUID;
  p2 UUID;
  t1 UUID;
  t2 UUID;
  t3 UUID;
  t4 UUID;
  duplicate_blocked BOOLEAN := FALSE;
  cycle_blocked BOOLEAN := FALSE;
  cross_project_blocked BOOLEAN := FALSE;
  self_dependency_blocked BOOLEAN := FALSE;
BEGIN
  -- Dataset minimal de test
  INSERT INTO projects (name, description)
  VALUES ('SMOKE-P1', 'Smoke test task dependencies')
  RETURNING id INTO p1;

  INSERT INTO projects (name, description)
  VALUES ('SMOKE-P2', 'Smoke test task dependencies')
  RETURNING id INTO p2;

  INSERT INTO tasks (project_id, title, status, priority)
  VALUES (p1, 'SMOKE-T1', 'todo', 'medium')
  RETURNING id INTO t1;

  INSERT INTO tasks (project_id, title, status, priority)
  VALUES (p1, 'SMOKE-T2', 'todo', 'medium')
  RETURNING id INTO t2;

  INSERT INTO tasks (project_id, title, status, priority)
  VALUES (p1, 'SMOKE-T3', 'todo', 'medium')
  RETURNING id INTO t3;

  INSERT INTO tasks (project_id, title, status, priority)
  VALUES (p2, 'SMOKE-T4', 'todo', 'medium')
  RETURNING id INTO t4;

  -- Cas autorisé: dépendance intra-projet sans cycle
  INSERT INTO task_dependencies (source_task_id, target_task_id, dependency_type)
  VALUES (t1, t2, 'finish_to_start');

  -- Cas interdit: doublon source->target
  BEGIN
    INSERT INTO task_dependencies (source_task_id, target_task_id, dependency_type)
    VALUES (t1, t2, 'finish_to_start');
  EXCEPTION
    WHEN unique_violation THEN
      duplicate_blocked := TRUE;
  END;

  -- Cas interdit: cycle t2 -> t1 (car t1 -> t2 existe)
  BEGIN
    INSERT INTO task_dependencies (source_task_id, target_task_id, dependency_type)
    VALUES (t2, t1, 'finish_to_start');
  EXCEPTION
    WHEN OTHERS THEN
      cycle_blocked := TRUE;
  END;

  -- Cas interdit: dépendance inter-projets (t1 -> t4)
  BEGIN
    INSERT INTO task_dependencies (source_task_id, target_task_id, dependency_type)
    VALUES (t1, t4, 'finish_to_start');
  EXCEPTION
    WHEN OTHERS THEN
      cross_project_blocked := TRUE;
  END;

  -- Cas interdit: auto-dépendance
  BEGIN
    INSERT INTO task_dependencies (source_task_id, target_task_id, dependency_type)
    VALUES (t3, t3, 'finish_to_start');
  EXCEPTION
    WHEN OTHERS THEN
      self_dependency_blocked := TRUE;
  END;

  -- Assertions finales
  IF NOT duplicate_blocked THEN
    RAISE EXCEPTION 'Smoke test FAILED: le doublon source->target aurait du etre bloque';
  END IF;

  IF NOT cycle_blocked THEN
    RAISE EXCEPTION 'Smoke test FAILED: le cycle aurait du etre bloque';
  END IF;

  IF NOT cross_project_blocked THEN
    RAISE EXCEPTION 'Smoke test FAILED: la dependance inter-projets aurait du etre bloquee';
  END IF;

  IF NOT self_dependency_blocked THEN
    RAISE EXCEPTION 'Smoke test FAILED: l''auto-dependance aurait du etre bloquee';
  END IF;

  RAISE NOTICE 'Smoke tests task_dependencies: OK';
END $$;

ROLLBACK;
