-- =====================================================
-- Migration: fix RLS worker_qualifications (UPDATE manquant)
-- =====================================================
-- worker_qualifications avait SELECT, INSERT, DELETE mais pas UPDATE.
-- Un membre pouvait donc mettre à jour via le client sans contrôle RLS.
-- Cette migration comble le gap.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS "Users can update worker qualifications" ON worker_qualifications;

DROP POLICY IF EXISTS "Users can update worker qualifications" ON worker_qualifications;

CREATE POLICY "Users can update worker qualifications" ON worker_qualifications
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
) WITH CHECK (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);
