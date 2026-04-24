-- Hotfix: restore FK coverage index required by task_assignees_user_id_fkey
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON public.task_assignees(user_id);
