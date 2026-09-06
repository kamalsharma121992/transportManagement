-- Optional receipt/bill image for expenses + public storage bucket
-- Run in Supabase SQL Editor
-- For multiple images, also run supabase/multi_images.sql

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-images', 'expense-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow all on expense-images" ON storage.objects;
CREATE POLICY "Allow all on expense-images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'expense-images')
  WITH CHECK (bucket_id = 'expense-images');
