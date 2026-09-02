-- Builty (transport receipt) image for trips + public storage bucket
-- Run in Supabase SQL Editor

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS builty_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-builty', 'trip-builty', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow all on trip-builty" ON storage.objects;
CREATE POLICY "Allow all on trip-builty"
  ON storage.objects FOR ALL
  USING (bucket_id = 'trip-builty')
  WITH CHECK (bucket_id = 'trip-builty');
