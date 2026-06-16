-- Driver payroll fields — run in Supabase SQL Editor (also in schema.sql)

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS left_date DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 25000;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS daily_allowance DECIMAL(12,2) NOT NULL DEFAULT 500;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS settlement_notes TEXT;

-- Pratap Ram — left, full & final settled
UPDATE drivers
SET status = 'inactive',
    left_date = COALESCE(left_date, '2026-05-31'),
    settlement_notes = COALESCE(settlement_notes, 'Full & final settled')
WHERE name = 'Pratap Ram';

-- Leave days (allowance not paid on these dates)
CREATE TABLE IF NOT EXISTS driver_leave (
  id SERIAL PRIMARY KEY,
  driver_name TEXT NOT NULL REFERENCES drivers(name),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_name, date)
);

CREATE INDEX IF NOT EXISTS idx_driver_leave_date ON driver_leave(date);
CREATE INDEX IF NOT EXISTS idx_driver_leave_driver ON driver_leave(driver_name);

ALTER TABLE driver_leave ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on driver_leave" ON driver_leave;
CREATE POLICY "Allow all on driver_leave" ON driver_leave FOR ALL USING (true) WITH CHECK (true);

-- Per-driver start/end within a payroll month (e.g. Laxman from 2nd, others from 4th)
CREATE TABLE IF NOT EXISTS driver_payroll_period (
  id SERIAL PRIMARY KEY,
  driver_name TEXT NOT NULL REFERENCES drivers(name),
  month TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_name, month)
);

CREATE INDEX IF NOT EXISTS idx_driver_payroll_period_month ON driver_payroll_period(month);

ALTER TABLE driver_payroll_period ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on driver_payroll_period" ON driver_payroll_period;
CREATE POLICY "Allow all on driver_payroll_period" ON driver_payroll_period FOR ALL USING (true) WITH CHECK (true);
