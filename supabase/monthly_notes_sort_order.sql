-- Persist sticky-note drag order per month
ALTER TABLE monthly_notes
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows: newest first → lower sort_order
WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY month
      ORDER BY created_at DESC, id DESC
    ) - 1) AS rn
  FROM monthly_notes
)
UPDATE monthly_notes n
SET sort_order = ranked.rn
FROM ranked
WHERE n.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_monthly_notes_month_sort
  ON monthly_notes (month, sort_order ASC, id ASC);
