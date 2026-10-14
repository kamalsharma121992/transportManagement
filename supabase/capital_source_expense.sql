-- Link a capital row to the expense that created it.
-- Direct Capital entries stay null. Deleting the expense clears the link on a paid row.
-- Run this in the Supabase SQL editor.

ALTER TABLE capital_contributions
  ADD COLUMN IF NOT EXISTS source_expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_capital_contributions_source_expense
  ON capital_contributions(source_expense_id);
