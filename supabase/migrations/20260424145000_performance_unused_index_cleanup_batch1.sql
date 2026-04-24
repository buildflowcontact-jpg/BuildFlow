-- Conservative cleanup: remove legacy unused indexes (idx_* family)
-- Excludes FK-support indexes (fkidx_* / *_fk_idx) and current core composite indexes.

DROP INDEX IF EXISTS public.idx_attachments_task;
DROP INDEX IF EXISTS public.idx_attachments_subtask;
DROP INDEX IF EXISTS public.idx_comments_task;
DROP INDEX IF EXISTS public.idx_comments_subtask;
DROP INDEX IF EXISTS public.idx_timelogs_task;
DROP INDEX IF EXISTS public.idx_timelogs_subtask;
DROP INDEX IF EXISTS public.idx_timelogs_date;
DROP INDEX IF EXISTS public.idx_budget_project;
DROP INDEX IF EXISTS public.idx_permissions_project;
DROP INDEX IF EXISTS public.idx_audit_logs_table_name;
DROP INDEX IF EXISTS public.idx_audit_logs_record_id;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_audit_logs_table_record;
DROP INDEX IF EXISTS public.idx_audit_trail_entity;
DROP INDEX IF EXISTS public.idx_audit_trail_project;
DROP INDEX IF EXISTS public.idx_task_assignees_task_id;
DROP INDEX IF EXISTS public.idx_task_assignees_user_id;
DROP INDEX IF EXISTS public.idx_work_packages_code;
DROP INDEX IF EXISTS public.idx_work_packages_order;
DROP INDEX IF EXISTS public.idx_work_packages_project_id;
DROP INDEX IF EXISTS public.idx_work_packages_project_status;
