-- Title/header + rich HTML body for monthly sticky notes
ALTER TABLE monthly_notes
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN monthly_notes.title IS 'Optional sticky note header';
COMMENT ON COLUMN monthly_notes.note IS 'Note body; may contain sanitized HTML (lists, bold, highlight)';
