
-- Create storage bucket for pet images
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-images', 'pet-images', true);

-- Allow authenticated users to upload pet images
CREATE POLICY "Users can upload pet images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pet-images');
CREATE POLICY "Anyone can view pet images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pet-images');
CREATE POLICY "Users can update pet images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'pet-images');
