-- Remove broad listing policies on public documents bucket.
-- Keep folder-scoped policy documents_storage_select as the only SELECT policy.

DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents in their projects" ON storage.objects;
