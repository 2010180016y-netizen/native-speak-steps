-- SEC-2: pet-images is written only by the generate-pet-image edge function
-- (service role, which bypasses RLS). Clients get no write access, and may list
-- only their own folder. Files stay readable through public URLs.
DROP POLICY IF EXISTS "Users can upload pet images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update pet images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view pet images" ON storage.objects;

CREATE POLICY "Users can view own pet images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pet-images' AND (storage.foldername(name))[1] = auth.uid()::text);

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png']
WHERE id = 'pet-images';
