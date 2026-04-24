DO $$
DECLARE
  r RECORD;
  qual_expr TEXT;
  check_expr TEXT;
  new_qual TEXT;
  new_check TEXT;
  stmt TEXT;
  touched_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name,
      p.polcmd AS cmd,
      pg_get_expr(p.polqual, p.polrelid) AS qual_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    qual_expr := r.qual_expr;
    check_expr := r.check_expr;

    IF (
      COALESCE(
        regexp_replace(
          regexp_replace(COALESCE(qual_expr, ''), '\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)', '', 'gi'),
          '\\(\\s*select\\s+auth\\.role\\(\\)\\s*\\)', '', 'gi'
        ),
        ''
      ) ~ 'auth\\.(uid|role)\\(\\)'
    )
    OR (
      COALESCE(
        regexp_replace(
          regexp_replace(COALESCE(check_expr, ''), '\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)', '', 'gi'),
          '\\(\\s*select\\s+auth\\.role\\(\\)\\s*\\)', '', 'gi'
        ),
        ''
      ) ~ 'auth\\.(uid|role)\\(\\)'
    ) THEN
      new_qual := qual_expr;
      new_check := check_expr;

      IF new_qual IS NOT NULL THEN
        new_qual := regexp_replace(new_qual, '\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)', '__WRAPPED_UID__', 'gi');
        new_qual := regexp_replace(new_qual, '\\(\\s*select\\s+auth\\.role\\(\\)\\s*\\)', '__WRAPPED_ROLE__', 'gi');
        new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
        new_qual := replace(new_qual, 'auth.role()', '(select auth.role())');
        new_qual := replace(new_qual, '__WRAPPED_UID__', '(select auth.uid())');
        new_qual := replace(new_qual, '__WRAPPED_ROLE__', '(select auth.role())');
      END IF;

      IF new_check IS NOT NULL THEN
        new_check := regexp_replace(new_check, '\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)', '__WRAPPED_UID__', 'gi');
        new_check := regexp_replace(new_check, '\\(\\s*select\\s+auth\\.role\\(\\)\\s*\\)', '__WRAPPED_ROLE__', 'gi');
        new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
        new_check := replace(new_check, 'auth.role()', '(select auth.role())');
        new_check := replace(new_check, '__WRAPPED_UID__', '(select auth.uid())');
        new_check := replace(new_check, '__WRAPPED_ROLE__', '(select auth.role())');
      END IF;

      IF r.cmd = 'r' OR r.cmd = 'd' THEN
        IF new_qual IS NOT NULL THEN
          stmt := format('ALTER POLICY %I ON %I.%I USING (%s)', r.policy_name, r.schema_name, r.table_name, new_qual);
          EXECUTE stmt;
          touched_count := touched_count + 1;
        END IF;
      ELSIF r.cmd = 'a' THEN
        IF new_check IS NOT NULL THEN
          stmt := format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', r.policy_name, r.schema_name, r.table_name, new_check);
          EXECUTE stmt;
          touched_count := touched_count + 1;
        END IF;
      ELSE
        stmt := format('ALTER POLICY %I ON %I.%I', r.policy_name, r.schema_name, r.table_name);
        IF new_qual IS NOT NULL THEN
          stmt := stmt || format(' USING (%s)', new_qual);
        END IF;
        IF new_check IS NOT NULL THEN
          stmt := stmt || format(' WITH CHECK (%s)', new_check);
        END IF;
        EXECUTE stmt;
        touched_count := touched_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Updated % policies for auth_rls_initplan optimization', touched_count;
END $$;
