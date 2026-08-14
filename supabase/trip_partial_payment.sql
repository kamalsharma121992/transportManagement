-- Expected payment date for pending trip balances + optional notes
-- Run in Supabase SQL Editor

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS payment_expected_date DATE;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE trips
SET payment_status = 'Pending'
WHERE payment_status = 'Partial Paid';
