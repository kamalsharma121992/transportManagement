-- Add commission to routes. Run in Supabase SQL Editor for existing projects.
ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS commission DECIMAL(10,2) NOT NULL DEFAULT 0;
