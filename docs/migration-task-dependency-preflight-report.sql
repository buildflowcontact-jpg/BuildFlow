-- =====================================================
-- Preflight report: task_dependencies
-- Date: 2026-04-15
-- Objectif: mesurer l'etat des donnees avant migrations
-- =====================================================

-- 1) Volume global
SELECT COUNT(*) AS total_dependencies
FROM task_dependencies;

-- 2) Doublons source -> target
SELECT COUNT(*) AS duplicate_pairs
FROM (
  SELECT source_task_id, target_task_id
  FROM task_dependencies
  GROUP BY source_task_id, target_task_id
  HAVING COUNT(*) > 1
) d;

-- Exemples de doublons
SELECT source_task_id, target_task_id, COUNT(*) AS duplicate_count
FROM task_dependencies
GROUP BY source_task_id, target_task_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, source_task_id, target_task_id
LIMIT 20;

-- 3) Auto-dependances
SELECT COUNT(*) AS self_dependencies
FROM task_dependencies
WHERE source_task_id = target_task_id;

-- Exemples d'auto-dependances
SELECT id, source_task_id, target_task_id, created_at
FROM task_dependencies
WHERE source_task_id = target_task_id
ORDER BY created_at DESC
LIMIT 20;

-- 4) Dependances inter-projets
SELECT COUNT(*) AS cross_project_dependencies
FROM task_dependencies td
JOIN tasks s ON s.id = td.source_task_id
JOIN tasks t ON t.id = td.target_task_id
WHERE s.project_id IS DISTINCT FROM t.project_id;

-- Exemples inter-projets
SELECT td.id, td.source_task_id, td.target_task_id, s.project_id AS source_project_id, t.project_id AS target_project_id, td.created_at
FROM task_dependencies td
JOIN tasks s ON s.id = td.source_task_id
JOIN tasks t ON t.id = td.target_task_id
WHERE s.project_id IS DISTINCT FROM t.project_id
ORDER BY td.created_at DESC
LIMIT 20;

-- 5) Detection de cycles (presence oui/non + exemple)
WITH RECURSIVE walk AS (
  SELECT
    td.source_task_id AS origin,
    td.target_task_id AS current,
    ARRAY[td.source_task_id, td.target_task_id]::uuid[] AS path,
    FALSE AS is_cycle
  FROM task_dependencies td

  UNION ALL

  SELECT
    w.origin,
    td.target_task_id AS current,
    w.path || td.target_task_id,
    td.target_task_id = w.origin AS is_cycle
  FROM walk w
  JOIN task_dependencies td ON td.source_task_id = w.current
  WHERE NOT w.is_cycle
    AND array_length(w.path, 1) < 200
    AND NOT (td.target_task_id = ANY(w.path[2:]))
), cycles AS (
  SELECT origin, current, path
  FROM walk
  WHERE is_cycle
)
SELECT EXISTS (SELECT 1 FROM cycles) AS has_cycle;

WITH RECURSIVE walk AS (
  SELECT
    td.source_task_id AS origin,
    td.target_task_id AS current,
    ARRAY[td.source_task_id, td.target_task_id]::uuid[] AS path,
    FALSE AS is_cycle
  FROM task_dependencies td

  UNION ALL

  SELECT
    w.origin,
    td.target_task_id AS current,
    w.path || td.target_task_id,
    td.target_task_id = w.origin AS is_cycle
  FROM walk w
  JOIN task_dependencies td ON td.source_task_id = w.current
  WHERE NOT w.is_cycle
    AND array_length(w.path, 1) < 200
    AND NOT (td.target_task_id = ANY(w.path[2:]))
), cycles AS (
  SELECT origin, current, path
  FROM walk
  WHERE is_cycle
)
SELECT origin AS cycle_origin, path AS cycle_path
FROM cycles
LIMIT 5;
