-- 1. Create the storage bucket 'exam_attachments'
-- This inserts a new public bucket into the system
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam_attachments', 'exam_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow Public Read Access (So students can see the images)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'exam_attachments' );

-- 3. Allow Authenticated Users (Admins) to Upload Images
CREATE POLICY "Authenticated Insert Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'exam_attachments' );

-- 4. Allow Admins to Delete/Update images (Optional)
CREATE POLICY "Authenticated Update/Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'exam_attachments' );
