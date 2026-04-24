-- Batch 3 (very conservative): drop unused non-FK helper indexes
DROP INDEX IF EXISTS public.automation_rules_trigger_event_idx;
DROP INDEX IF EXISTS public.document_versions_status_idx;
DROP INDEX IF EXISTS public.risk_register_status_idx;
DROP INDEX IF EXISTS public.resource_permissions_expires_idx;
DROP INDEX IF EXISTS public.tasks_assignee_ids_gin_idx;
DROP INDEX IF EXISTS public.virtual_members_email_idx;
DROP INDEX IF EXISTS public.attachments_related_idx;
