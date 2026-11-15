-- Free-form sticky note position on the dashboard (px within the board)
ALTER TABLE monthly_notes
  ADD COLUMN IF NOT EXISTS pos_x DOUBLE PRECISION NOT NULL DEFAULT 24;

ALTER TABLE monthly_notes
  ADD COLUMN IF NOT EXISTS pos_y DOUBLE PRECISION NOT NULL DEFAULT 72;

-- Spread existing notes so they do not stack on top of each other
WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY month
      ORDER BY sort_order ASC, created_at DESC, id DESC
    ) - 1) AS rn
  FROM monthly_notes
)
UPDATE monthly_notes n
SET
  pos_x = 24 + (ranked.rn % 4) * 220,
  pos_y = 72 + FLOOR(ranked.rn / 4.0) * 160
FROM ranked
WHERE n.id = ranked.id;
