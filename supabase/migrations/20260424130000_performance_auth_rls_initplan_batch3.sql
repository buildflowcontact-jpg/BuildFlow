-- Batch 3: Optimize auth_rls_initplan alerts (5 remaining tables)
-- Target: saved_filters, notifications, resource_permissions, time_entries, comments
-- Expected impact: ~18 additional alerts eliminated (120 → 102)

-- ============================================================================
-- saved_filters (4 policies)
-- ============================================================================
ALTER POLICY "Users can create saved filters" ON saved_filters
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update their saved filters" ON saved_filters
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete their saved filters" ON saved_filters
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- notifications (4 policies)
-- ============================================================================
ALTER POLICY "Users can view their notifications" ON notifications
USING ((select auth.uid()) = user_id);

ALTER POLICY "Authenticated users can create notifications" ON notifications
WITH CHECK (auth.role() = 'authenticated');

ALTER POLICY "Users can update their notifications" ON notifications
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete their notifications" ON notifications
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- resource_permissions (4 policies)
-- ============================================================================
ALTER POLICY "Users can view permissions on their resources" ON resource_permissions
USING (
  (select auth.uid()) = granted_by OR
  (resource_type = 'project' AND auth_is_project_owner(resource_id)) OR
  (resource_type = 'task' AND EXISTS (
    SELECT 1 FROM tasks WHERE id = resource_id AND created_by = (select auth.uid())
  ))
);

ALTER POLICY "Resource owners can grant permissions" ON resource_permissions
WITH CHECK (
  (resource_type = 'project' AND auth_is_project_owner(resource_id)) OR
  (resource_type = 'task' AND EXISTS (
    SELECT 1 FROM tasks WHERE id = resource_id AND created_by = (select auth.uid())
  ))
);

ALTER POLICY "Resource owners can modify permissions" ON resource_permissions
USING (
  (select auth.uid()) = granted_by OR
  (resource_type = 'project' AND auth_is_project_owner(resource_id))
)
WITH CHECK (
  (select auth.uid()) = granted_by OR
  (resource_type = 'project' AND auth_is_project_owner(resource_id))
);

ALTER POLICY "Resource owners can revoke permissions" ON resource_permissions
USING (
  (select auth.uid()) = granted_by OR
  (resource_type = 'project' AND auth_is_project_owner(resource_id))
);

-- ============================================================================
-- time_entries (4 policies)
-- ============================================================================
ALTER POLICY "Users can view time entries of accessible tasks" ON time_entries
USING (
  (select auth.uid()) = user_id OR
  EXISTS (
    SELECT 1 FROM tasks WHERE id = time_entries.task_id AND (
      created_by = (select auth.uid()) OR
      auth_is_project_owner(project_id)
    )
  )
);

ALTER POLICY "Users can log their time" ON time_entries
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can modify their time entries" ON time_entries
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete their time entries" ON time_entries
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- comments (4 policies)
-- ============================================================================
ALTER POLICY "Users can view comments on accessible tasks" ON comments
USING (
  (select auth.uid()) = author_id OR EXISTS (
    SELECT 1 FROM tasks WHERE id = comments.task_id AND (
      created_by = (select auth.uid()) OR
      assigned_to = (select auth.uid()) OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

ALTER POLICY "Users can create comments" ON comments
WITH CHECK ((select auth.uid()) = author_id);

ALTER POLICY "Users can update their comments" ON comments
USING ((select auth.uid()) = author_id)
WITH CHECK ((select auth.uid()) = author_id);

ALTER POLICY "Users can delete their comments" ON comments
USING ((select auth.uid()) = author_id);
