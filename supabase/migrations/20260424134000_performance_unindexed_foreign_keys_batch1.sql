-- Batch 1: Reduce unindexed_foreign_keys using advisor-scoped target list
-- Scope: 42 FK constraints reported by Supabase advisor at execution time
-- Strategy: create covering indexes only when missing

DO $$
DECLARE
  r RECORD;
  idx_name TEXT;
  idx_cols TEXT;
  created_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      t.relname AS table_name,
      c.conname AS constraint_name,
      c.conkey,
      ARRAY_AGG(a.attname ORDER BY u.ord) AS fk_cols
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
    JOIN (
      VALUES
        ('public','audit_log_user_id_fkey'),
        ('public','budgets_user_id_fkey'),
        ('public','comment_reactions_user_id_fkey'),
        ('public','document_versions_signed_by_fkey'),
        ('public','documents_project_id_fkey'),
        ('public','documents_uploaded_by_fkey'),
        ('public','equipment_bookings_created_by_fkey'),
        ('public','expenses_created_by_fkey'),
        ('public','expenses_parent_id_fkey'),
        ('public','key_results_objective_id_fkey'),
        ('public','milestones_owner_id_fkey'),
        ('public','notifications_project_id_fkey'),
        ('public','notifications_task_id_fkey'),
        ('public','objectives_created_by_fkey'),
        ('public','objectives_project_id_fkey'),
        ('public','profiles_organization_id_fkey'),
        ('public','project_baselines_created_by_fkey'),
        ('public','project_invitations_created_by_fkey'),
        ('public','project_invitations_project_id_fkey'),
        ('public','project_members_user_id_fkey'),
        ('public','project_permissions_profile_id_fkey'),
        ('public','project_subcontractors_created_by_fkey'),
        ('public','projects_created_by_fkey'),
        ('public','recurrent_tasks_template_task_id_fkey'),
        ('public','resource_permissions_granted_by_fkey'),
        ('public','risk_register_created_by_fkey'),
        ('public','safety_checklist_items_created_by_fkey'),
        ('public','site_incidents_created_by_fkey'),
        ('public','site_incidents_linked_phase_id_fkey'),
        ('public','site_journal_entries_created_by_fkey'),
        ('public','site_photos_uploaded_by_fkey'),
        ('public','site_zones_created_by_fkey'),
        ('public','site_zones_parent_zone_id_fkey'),
        ('public','sla_rules_created_by_fkey'),
        ('public','sla_violations_task_id_fkey'),
        ('public','subtasks_task_id_fkey'),
        ('public','supply_orders_created_by_fkey'),
        ('public','tasks_assigned_to_fkey'),
        ('public','tasks_created_by_fkey'),
        ('public','team_capacity_user_id_fkey'),
        ('public','virtual_members_source_favorite_id_fkey'),
        ('public','worker_qualifications_created_by_fkey')
    ) AS target(schema_name, constraint_name)
      ON target.schema_name = n.nspname
     AND target.constraint_name = c.conname
    WHERE c.contype = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND i.indisvalid
          AND i.indpred IS NULL
          AND (i.indkey::smallint[])[1:array_length(c.conkey, 1)] = c.conkey
      )
    GROUP BY n.nspname, t.relname, c.conname, c.conrelid, c.conkey
  LOOP
    idx_name := format('fkidx_%s_%s', left(r.table_name, 30), substr(md5(r.constraint_name), 1, 8));
    idx_cols := array_to_string(ARRAY(
      SELECT format('%I', col_name)
      FROM unnest(r.fk_cols) AS col_name
    ), ', ');

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      idx_name,
      r.schema_name,
      r.table_name,
      idx_cols
    );

    created_count := created_count + 1;
  END LOOP;

  RAISE NOTICE 'Created % FK indexes from advisor target set', created_count;
END $$;
