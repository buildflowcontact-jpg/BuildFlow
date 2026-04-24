-- Make implicit deny-all explicit on tables with RLS enabled but no policy
-- This preserves current behavior while satisfying advisor checks.

-- public.audit_log
CREATE POLICY "No access audit_log select" ON public.audit_log
FOR SELECT
USING (false);

CREATE POLICY "No access audit_log insert" ON public.audit_log
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No access audit_log update" ON public.audit_log
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No access audit_log delete" ON public.audit_log
FOR DELETE
USING (false);

-- public.budgets
CREATE POLICY "No access budgets select" ON public.budgets
FOR SELECT
USING (false);

CREATE POLICY "No access budgets insert" ON public.budgets
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No access budgets update" ON public.budgets
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No access budgets delete" ON public.budgets
FOR DELETE
USING (false);

-- public.task_assignees
CREATE POLICY "No access task_assignees select" ON public.task_assignees
FOR SELECT
USING (false);

CREATE POLICY "No access task_assignees insert" ON public.task_assignees
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No access task_assignees update" ON public.task_assignees
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No access task_assignees delete" ON public.task_assignees
FOR DELETE
USING (false);
