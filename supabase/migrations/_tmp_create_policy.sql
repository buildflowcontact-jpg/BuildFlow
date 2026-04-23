CREATE POLICY "Project members can create notifications" ON notifications
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND (
        auth_is_project_member(project_id)
        OR auth_is_project_owner(project_id)
      )
    )
  )
)
