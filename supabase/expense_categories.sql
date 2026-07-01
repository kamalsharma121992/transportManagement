-- Run this in Supabase SQL Editor to enable admin-managed expense categories

CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  expense_type expense_type NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, expense_type)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_type ON expense_categories(expense_type);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on expense_categories" ON expense_categories FOR ALL USING (true) WITH CHECK (true);

INSERT INTO expense_categories (name, expense_type, sort_order) VALUES
  ('Fuel (Diesel)', 'vehicle', 1),
  ('Toll Taxes', 'vehicle', 2),
  ('Maintenance', 'vehicle', 3),
  ('Insurance', 'vehicle', 4),
  ('EMI / Loan Payments', 'vehicle', 5),
  ('Driver Salary', 'vehicle', 6),
  ('Others', 'vehicle', 7),
  ('Meals', 'operational', 1),
  ('Hotel Stay', 'operational', 2),
  ('Rent', 'operational', 3),
  ('Supplies', 'operational', 4),
  ('Daily Allowance', 'operational', 5),
  ('Advance', 'operational', 6),
  ('Salary', 'operational', 7),
  ('Partner Allowance', 'operational', 8),
  ('Office Expense', 'operational', 9),
  ('Credit Card Payment', 'operational', 10),
  ('Personal Care', 'personal', 1),
  ('Other', 'personal', 2),
  ('Other', 'other', 1)
ON CONFLICT (name, expense_type) DO NOTHING;
