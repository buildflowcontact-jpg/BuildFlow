-- =====================================================
-- Migration: hardening contraintes task_dependencies
-- Date: 2026-04-15
-- Objectif:
--  1) Nettoyer les auto-dependances legacy
--  2) Nettoyer les doublons source->target
--  3) Garantir les contraintes no_self_dependency + unique_task_dependency_link
-- =====================================================

BEGIN;

-- 1) Nettoyage des auto-dependances legacy
DELETE FROM task_dependencies
WHERE source_task_id = target_task_id;

-- 2) Nettoyage des doublons source->target
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

-- 3) Contraintes critiques: ajout idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'task_dependencies'
      AND con.conname = 'no_self_dependency'
  ) THEN
    ALTER TABLE task_dependencies
      ADD CONSTRAINT no_self_dependency
      CHECK (source_task_id <> target_task_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'task_dependencies'
      AND con.conname = 'unique_task_dependency_link'
  ) THEN
    ALTER TABLE task_dependencies
      ADD CONSTRAINT unique_task_dependency_link
      UNIQUE (source_task_id, target_task_id);
  END IF;
END $$;

COMMIT;
