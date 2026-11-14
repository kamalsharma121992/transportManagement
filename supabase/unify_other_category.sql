-- Merge vehicle category "Others" into "Other" (same label across expense types).

-- 1) Expenses that used the vehicle "Others" label
UPDATE expenses
SET category = 'Other'
WHERE category = 'Others';

-- 2) Ensure vehicle has "Other" in the catalog
INSERT INTO expense_categories (name, expense_type, sort_order)
VALUES ('Other', 'vehicle', 7)
ON CONFLICT (name, expense_type) DO NOTHING;

-- 3) Drop the old plural catalog row
DELETE FROM expense_categories
WHERE name = 'Others'
  AND expense_type = 'vehicle';
