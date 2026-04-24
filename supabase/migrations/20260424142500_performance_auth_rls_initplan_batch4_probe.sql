ALTER POLICY "Users can create projects" ON public.projects
WITH CHECK ((select auth.uid()) = created_by);
