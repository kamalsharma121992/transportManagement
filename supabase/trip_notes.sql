-- Multiple notes per trip (added by, date, editable)
CREATE TABLE IF NOT EXISTS trip_notes (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trip_notes_trip ON trip_notes (trip_id, created_at DESC);

ALTER TABLE trip_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on trip_notes" ON trip_notes;
CREATE POLICY "Allow all on trip_notes" ON trip_notes FOR ALL USING (true) WITH CHECK (true);

-- Migrate legacy single trips.notes into timeline (once per trip)
INSERT INTO trip_notes (trip_id, note, created_by, created_at)
SELECT t.id, t.notes, 'Migrated', COALESCE(t.created_at, NOW())
FROM trips t
WHERE t.notes IS NOT NULL
  AND btrim(t.notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM trip_notes tn WHERE tn.trip_id = t.id
  );
