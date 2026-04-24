ALTER POLICY "Allow authenticated delete" ON public.work_packages
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Allow authenticated insert" ON public.work_packages
WITH CHECK ((select auth.role()) = 'authenticated');

ALTER POLICY "Allow authenticated read" ON public.work_packages
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Allow authenticated update" ON public.work_packages
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Allow authenticated delete" ON public.audit_trail
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Allow authenticated insert" ON public.audit_trail
WITH CHECK ((select auth.role()) = 'authenticated');

ALTER POLICY "Allow authenticated read" ON public.audit_trail
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Allow authenticated update" ON public.audit_trail
USING ((select auth.role()) = 'authenticated');

ALTER POLICY "Users can delete their own attachments" ON public.task_attachments
USING (uploaded_by = (select auth.uid()))
WITH CHECK (uploaded_by = (select auth.uid()));

ALTER POLICY "Users can update their own comments" ON public.task_comments
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "Users can update their own time logs" ON public.time_logs
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));
