-- Add explicit storage path for documents and tighten storage visibility.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Backfill storage_path from existing URL when possible.
UPDATE documents
SET storage_path = SUBSTRING(url FROM '/documents/([^?]+)')
WHERE storage_path IS NULL
  AND url LIKE '%/documents/%';

-- Ensure the bucket is private.
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'documents';

DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;

-- Read allowed only for authenticated users.
CREATE POLICY "documents_storage_select" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
