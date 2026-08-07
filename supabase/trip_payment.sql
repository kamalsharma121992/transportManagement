-- Run this in Supabase → SQL Editor → New query → Run

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Fully Paid';

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS commission DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE trips
  ALTER COLUMN payment_status SET DEFAULT 'Fully Paid';
