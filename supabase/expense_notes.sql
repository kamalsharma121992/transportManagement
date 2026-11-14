-- Multiple notes per expense (added by, date, editable)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS expense_notes (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_expense_notes_expense ON expense_notes (expense_id, created_at DESC);

ALTER TABLE expense_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on expense_notes" ON expense_notes;
CREATE POLICY "Allow all on expense_notes" ON expense_notes FOR ALL USING (true) WITH CHECK (true);

-- Seed timeline from expenses.notes when present (once per expense)
INSERT INTO expense_notes (expense_id, note, created_by, created_at)
SELECT e.id, e.notes, 'Migrated', COALESCE(e.created_at, NOW())
FROM expenses e
WHERE e.notes IS NOT NULL
  AND btrim(e.notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM expense_notes en WHERE en.expense_id = e.id
  );
