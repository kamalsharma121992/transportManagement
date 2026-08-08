-- Expense Advances — run once in Supabase SQL Editor
-- Issue via Expenses (category = Expense Advance); track/settle on /expense-advances

CREATE TABLE IF NOT EXISTS expense_advances (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  person TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  source_expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_advances_date ON expense_advances(date);
CREATE INDEX IF NOT EXISTS idx_expense_advances_person ON expense_advances(person);
CREATE INDEX IF NOT EXISTS idx_expense_advances_status ON expense_advances(status);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS expense_advance_id INTEGER REFERENCES expense_advances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_expense_advance ON expenses(expense_advance_id);

ALTER TABLE expense_advances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on expense_advances" ON expense_advances;
CREATE POLICY "Allow all on expense_advances" ON expense_advances FOR ALL USING (true) WITH CHECK (true);

INSERT INTO expense_categories (name, expense_type, sort_order) VALUES
  ('Expense Advance', 'operational', 11),
  ('Other', 'operational', 12)
ON CONFLICT (name, expense_type) DO NOTHING;
