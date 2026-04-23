-- =====================================================
-- Vérification d'intégrité: task_dependencies
-- Date: 2026-04-15
-- Usage: exécuter après les migrations de durcissement
-- Objectif: échouer explicitement si des incohérences subsistent
-- =====================================================

DO $$
DECLARE
  duplicate_links_count BIGINT;
  self_links_count BIGINT;
  cross_project_links_count BIGINT;
  cycle_count BIGINT;
BEGIN
  -- 1) Vérifier les doublons source -> target
  SELECT COUNT(*) INTO duplicate_links_count
  FROM (
    SELECT source_task_id, target_task_id
    FROM task_dependencies
    GROUP BY source_task_id, target_task_id
    HAVING COUNT(*) > 1
  ) d;

  IF duplicate_links_count > 0 THEN
    RAISE EXCEPTION 'Echec intégrité: % lien(s) de dépendance dupliqué(s) détecté(s)', duplicate_links_count;
  END IF;

  -- 2) Vérifier l'absence d'auto-dépendance
  SELECT COUNT(*) INTO self_links_count
  FROM task_dependencies
  WHERE source_task_id = target_task_id;

  IF self_links_count > 0 THEN
    RAISE EXCEPTION 'Echec intégrité: % auto-dépendance(s) détectée(s)', self_links_count;
  END IF;

  -- 3) Vérifier l'absence de dépendances inter-projets
  SELECT COUNT(*) INTO cross_project_links_count
  FROM task_dependencies td
  JOIN tasks s ON s.id = td.source_task_id
  JOIN tasks t ON t.id = td.target_task_id
  WHERE s.project_id IS DISTINCT FROM t.project_id;

  IF cross_project_links_count > 0 THEN
    RAISE EXCEPTION 'Echec intégrité: % dépendance(s) inter-projets détectée(s)', cross_project_links_count;
  END IF;

  -- 4) Vérifier l'absence de cycles
  SELECT COUNT(*) INTO cycle_count
  FROM (
    SELECT 1
    FROM task_dependencies e
    WHERE EXISTS (
      WITH RECURSIVE downstream(task_id, path) AS (
        SELECT td.target_task_id, ARRAY[e.target_task_id, td.target_task_id]::uuid[]
        FROM task_dependencies td
        WHERE td.source_task_id = e.target_task_id

        UNION ALL

        SELECT td.target_task_id, d.path || td.target_task_id
        FROM downstream d
        JOIN task_dependencies td ON td.source_task_id = d.task_id
        WHERE NOT (td.target_task_id = ANY(d.path))
      )
      SELECT 1
      FROM downstream
      WHERE task_id = e.source_task_id
      LIMIT 1
    )
    LIMIT 1
  ) c;

  IF cycle_count > 0 THEN
    RAISE EXCEPTION 'Echec intégrité: cycle(s) détecté(s) dans task_dependencies';
  END IF;

  RAISE NOTICE 'OK intégrité task_dependencies: aucune anomalie détectée.';
END $$;
