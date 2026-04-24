ALTER POLICY "Users can create expenses" ON public.expenses
WITH CHECK (((select auth.uid()) = created_by) AND ((project_id IS NULL) OR auth_is_project_member(project_id) OR auth_is_project_owner(project_id)));

ALTER POLICY "Users can delete their expenses" ON public.expenses
USING (((select auth.uid()) = created_by) OR ((project_id IS NOT NULL) AND (auth_is_project_member(project_id) OR auth_is_project_owner(project_id))));

ALTER POLICY "Users can update their expenses" ON public.expenses
USING (((select auth.uid()) = created_by) OR ((project_id IS NOT NULL) AND (auth_is_project_member(project_id) OR auth_is_project_owner(project_id))));

ALTER POLICY "Users can view their expenses" ON public.expenses
USING (((select auth.uid()) = created_by) OR ((project_id IS NOT NULL) AND (auth_is_project_member(project_id) OR auth_is_project_owner(project_id))));

ALTER POLICY "Task owners can delete recurrence" ON public.recurrent_tasks
USING (EXISTS (
  SELECT 1
  FROM tasks
  WHERE tasks.id = recurrent_tasks.template_task_id
    AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_owner(tasks.project_id))
));

ALTER POLICY "Task owners can manage recurrence" ON public.recurrent_tasks
WITH CHECK (EXISTS (
  SELECT 1
  FROM tasks
  WHERE tasks.id = recurrent_tasks.template_task_id
    AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_owner(tasks.project_id))
));

ALTER POLICY "Task owners can update recurrence" ON public.recurrent_tasks
USING (EXISTS (
  SELECT 1
  FROM tasks
  WHERE tasks.id = recurrent_tasks.template_task_id
    AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_owner(tasks.project_id))
));

ALTER POLICY "Users can view recurrent tasks" ON public.recurrent_tasks
USING (EXISTS (
  SELECT 1
  FROM tasks
  WHERE tasks.id = recurrent_tasks.template_task_id
    AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_member(tasks.project_id))
));

ALTER POLICY "Users can create dependencies" ON public.task_dependencies
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = task_dependencies.source_task_id
      AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_member(tasks.project_id) OR auth_is_project_owner(tasks.project_id))
  )
  AND EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = task_dependencies.target_task_id
      AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_member(tasks.project_id) OR auth_is_project_owner(tasks.project_id))
  )
);

ALTER POLICY "Users can delete dependencies" ON public.task_dependencies
USING (EXISTS (
  SELECT 1
  FROM tasks
  WHERE tasks.id = task_dependencies.source_task_id
    AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_member(tasks.project_id) OR auth_is_project_owner(tasks.project_id))
));

ALTER POLICY "Users can update dependencies" ON public.task_dependencies
USING (EXISTS (
  SELECT 1
  FROM tasks
  WHERE tasks.id = task_dependencies.source_task_id
    AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_member(tasks.project_id) OR auth_is_project_owner(tasks.project_id))
))
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = task_dependencies.source_task_id
      AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_member(tasks.project_id) OR auth_is_project_owner(tasks.project_id))
  )
  AND EXISTS (
    SELECT 1
    FROM tasks
    WHERE tasks.id = task_dependencies.target_task_id
      AND (((select auth.uid()) = tasks.created_by) OR auth_is_project_member(tasks.project_id) OR auth_is_project_owner(tasks.project_id))
  )
);

ALTER POLICY "Users can view dependencies of accessible tasks" ON public.task_dependencies
USING (EXISTS (
  SELECT 1
  FROM tasks
  WHERE (tasks.id = task_dependencies.source_task_id OR tasks.id = task_dependencies.target_task_id)
    AND (((select auth.uid()) = tasks.created_by) OR ((select auth.uid()) = tasks.assigned_to) OR auth_is_project_member(tasks.project_id) OR auth_is_project_owner(tasks.project_id))
));

ALTER POLICY "Template creators can delete" ON public.task_templates
USING ((select auth.uid()) = created_by);

ALTER POLICY "Template creators can update" ON public.task_templates
USING ((select auth.uid()) = created_by);

ALTER POLICY "Users can create templates" ON public.task_templates
WITH CHECK (((select auth.uid()) = created_by) AND ((project_id IS NULL) OR auth_is_project_member(project_id) OR auth_is_project_owner(project_id)));

ALTER POLICY "Users can view templates" ON public.task_templates
USING ((project_id IS NULL) OR (((select auth.uid()) = created_by) OR auth_is_project_member(project_id) OR auth_is_project_owner(project_id)));

ALTER POLICY "Users can create virtual members" ON public.virtual_members
WITH CHECK (((select auth.uid()) = created_by) AND (((project_id IS NULL) AND (is_favorite = true)) OR ((project_id IS NOT NULL) AND (auth_is_project_member(project_id) OR auth_is_project_owner(project_id)))));

ALTER POLICY "Users can delete their virtual members" ON public.virtual_members
USING (((select auth.uid()) = created_by) OR ((project_id IS NOT NULL) AND auth_is_project_owner(project_id)));

ALTER POLICY "Users can update their virtual members" ON public.virtual_members
USING (((select auth.uid()) = created_by) OR ((project_id IS NOT NULL) AND auth_is_project_owner(project_id)));

ALTER POLICY "Users can view their virtual members" ON public.virtual_members
USING (((select auth.uid()) = created_by) OR ((project_id IS NOT NULL) AND (auth_is_project_member(project_id) OR auth_is_project_owner(project_id))));
