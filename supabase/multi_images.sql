-- Multiple images for trips (builty) and expenses
-- Run in Supabase SQL Editor

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS builty_urls TEXT[] DEFAULT '{}';

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Migrate existing single-image columns into arrays
UPDATE trips
SET builty_urls = ARRAY[builty_url]
WHERE builty_url IS NOT NULL
  AND builty_url <> ''
  AND (builty_urls IS NULL OR cardinality(builty_urls) = 0);

UPDATE expenses
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND image_url <> ''
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);
