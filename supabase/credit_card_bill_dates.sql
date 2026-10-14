-- Bill generate day and bill pay day (1–31, repeats every month)
-- Run in Supabase SQL Editor

ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS bill_generate_day SMALLINT,
  ADD COLUMN IF NOT EXISTS bill_pay_day SMALLINT;

ALTER TABLE credit_cards DROP CONSTRAINT IF EXISTS credit_cards_bill_generate_day_check;
ALTER TABLE credit_cards
  ADD CONSTRAINT credit_cards_bill_generate_day_check
  CHECK (bill_generate_day IS NULL OR bill_generate_day BETWEEN 1 AND 31);

ALTER TABLE credit_cards DROP CONSTRAINT IF EXISTS credit_cards_bill_pay_day_check;
ALTER TABLE credit_cards
  ADD CONSTRAINT credit_cards_bill_pay_day_check
  CHECK (bill_pay_day IS NULL OR bill_pay_day BETWEEN 1 AND 31);
