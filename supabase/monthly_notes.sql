-- Sticky notes scoped to a calendar month (YYYY-MM)
CREATE TABLE IF NOT EXISTS monthly_notes (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  note TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  pos_x DOUBLE PRECISION NOT NULL DEFAULT 24,
  pos_y DOUBLE PRECISION NOT NULL DEFAULT 72,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_monthly_notes_month
  ON monthly_notes (month, is_hidden, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_notes_month_sort
  ON monthly_notes (month, sort_order ASC, id ASC);

ALTER TABLE monthly_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on monthly_notes" ON monthly_notes;
CREATE POLICY "Allow all on monthly_notes" ON monthly_notes FOR ALL USING (true) WITH CHECK (true);
