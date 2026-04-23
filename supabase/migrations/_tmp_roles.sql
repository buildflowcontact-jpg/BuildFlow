SELECT rolname, rolsuper FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin')
