-- Treat expense_notes as multi-entry descriptions; keep expenses.description as latest preview.
-- Seed timeline from legacy description when an expense has no timeline rows yet.
INSERT INTO expense_notes (expense_id, note, created_by, created_at)
SELECT e.id, e.description, 'Migrated', COALESCE(e.created_at, NOW())
FROM expenses e
WHERE e.description IS NOT NULL
  AND btrim(e.description) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM expense_notes en WHERE en.expense_id = e.id
  );

-- Refresh list preview from latest timeline entry
UPDATE expenses e
SET description = sub.note
FROM (
  SELECT DISTINCT ON (expense_id)
    expense_id,
    note
  FROM expense_notes
  ORDER BY expense_id, created_at DESC, id DESC
) sub
WHERE e.id = sub.expense_id
  AND e.description IS DISTINCT FROM sub.note;
