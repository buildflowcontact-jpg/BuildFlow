-- =====================================================
-- Migration: Durcissement RLS pour task_dependencies
-- =====================================================
-- 1) Exiger des droits sur source_task_id ET target_task_id pour INSERT/UPDATE
-- 2) Autoriser UPDATE explicitement (policy dédiée)
-- 3) Harmoniser DELETE avec les droits membre/propriétaire

BEGIN;

DROP POLICY IF EXISTS "Users can create dependencies" ON task_dependencies;
DROP POLICY IF EXISTS "Users can update dependencies" ON task_dependencies;
DROP POLICY IF EXISTS "Users can delete dependencies" ON task_dependencies;

CREATE POLICY "Users can create dependencies" ON task_dependencies
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
  AND EXISTS (
    SELECT 1 FROM tasks WHERE id = target_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can update dependencies" ON task_dependencies
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
  AND EXISTS (
    SELECT 1 FROM tasks WHERE id = target_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can delete dependencies" ON task_dependencies
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

COMMIT;
