-- Truck Management Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Partners (companies/people who pay or contribute)
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  joined_date DATE DEFAULT CURRENT_DATE,
  left_date DATE,
  monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 25000,
  daily_allowance DECIMAL(12,2) NOT NULL DEFAULT 500,
  settlement_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  vehicle_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'Truck',
  model TEXT,
  capacity_tons DECIMAL(10,2),
  chassis_number TEXT,
  insurance_expiry DATE,
  permit_expiry DATE,
  puc_expiry DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routes
CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  route_name TEXT NOT NULL UNIQUE,
  distance_km DECIMAL(10,2) NOT NULL,
  standard_rate_per_ton DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  vehicle_number TEXT NOT NULL REFERENCES vehicles(vehicle_number),
  route_name TEXT NOT NULL REFERENCES routes(route_name),
  driver_name TEXT NOT NULL REFERENCES drivers(name),
  weight_tons DECIMAL(10,2) NOT NULL,
  distance_km DECIMAL(10,2) NOT NULL,
  rate_per_ton DECIMAL(10,2) NOT NULL,
  total_revenue DECIMAL(12,2) NOT NULL,
  advance_paid DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unified Expenses
CREATE TYPE expense_type AS ENUM ('vehicle', 'operational', 'personal', 'other');

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  expense_type expense_type NOT NULL,
  vehicle_number TEXT REFERENCES vehicles(vehicle_number),
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  person TEXT,
  paid_by_person TEXT,
  bill_receipt_ref TEXT,
  paid_by TEXT DEFAULT 'JM transport' REFERENCES partners(name),
  status TEXT DEFAULT 'Paid',
  payment_source TEXT DEFAULT 'Partner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capital Contributions
CREATE TABLE IF NOT EXISTS capital_contributions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  contributor TEXT NOT NULL REFERENCES partners(name),
  contribution_type TEXT NOT NULL DEFAULT 'Credit Card',
  value DECIMAL(12,2) NOT NULL,
  description TEXT,
  asset_details TEXT,
  status TEXT DEFAULT 'Unpaid',
  paid_date DATE,
  paid_by TEXT DEFAULT 'JM transport',
  payment_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banking / Loan Information
CREATE TABLE IF NOT EXISTS banking_information (
  id SERIAL PRIMARY KEY,
  vehicle_number TEXT NOT NULL REFERENCES vehicles(vehicle_number),
  bank_name TEXT NOT NULL,
  account_number TEXT,
  purchase_date DATE,
  ex_showroom_price DECIMAL(14,2),
  down_payment DECIMAL(14,2),
  loan_amount DECIMAL(14,2),
  interest_rate DECIMAL(5,2),
  loan_tenure_months INTEGER,
  monthly_emi DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle ON expenses(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_capital_contributions_date ON capital_contributions(date);

-- Expense categories (managed in Admin)
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  expense_type expense_type NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, expense_type)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_type ON expense_categories(expense_type);

-- Enable Row Level Security (open for now - add auth policies later)
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Allow public access (no auth required for now)
CREATE POLICY "Allow all on partners" ON partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on routes" ON routes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on trips" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on capital_contributions" ON capital_contributions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on banking_information" ON banking_information FOR ALL USING (true) WITH CHECK (true);
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

-- Dashboard stats RPC (aggregates in DB — run this if upgrading an existing project)
CREATE OR REPLACE FUNCTION public.dashboard_stats(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_trip_vehicle text DEFAULT NULL,
  p_trip_search text DEFAULT NULL,
  p_exp_paid_by text DEFAULT NULL,
  p_exp_paid_by_person text DEFAULT NULL,
  p_exp_person text DEFAULT NULL,
  p_exp_vehicle text DEFAULT NULL,
  p_exp_payment_source text DEFAULT NULL,
  p_exp_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_count bigint;
  trip_revenue numeric;
  exp_count bigint;
  exp_total numeric;
  jm_total numeric;
  mahesh_total numeric;
  capital_total numeric;
  cash_revenue numeric;
  cash_exp_revenue numeric;
  cash_cap_revenue numeric;
  trip_pattern text;
  exp_pattern text;
BEGIN
  trip_pattern := CASE
    WHEN p_trip_search IS NULL OR btrim(p_trip_search) = '' THEN NULL
    ELSE '%' || replace(replace(replace(btrim(p_trip_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;
  exp_pattern := CASE
    WHEN p_exp_search IS NULL OR btrim(p_exp_search) = '' THEN NULL
    ELSE '%' || replace(replace(replace(btrim(p_exp_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;

  SELECT count(*)::bigint, coalesce(sum(total_revenue), 0)
  INTO trip_count, trip_revenue
  FROM trips t
  WHERE (p_date_from IS NULL OR t.date >= p_date_from)
    AND (p_date_to IS NULL OR t.date <= p_date_to)
    AND (p_trip_vehicle IS NULL OR p_trip_vehicle = '' OR t.vehicle_number = p_trip_vehicle)
    AND (
      trip_pattern IS NULL OR
      t.vehicle_number ILIKE trip_pattern OR
      t.route_name ILIKE trip_pattern OR
      t.driver_name ILIKE trip_pattern
    );

  SELECT count(*)::bigint,
         coalesce(sum(amount), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'JM transport'), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'Mahesh'), 0)
  INTO exp_count, exp_total, jm_total, mahesh_total
  FROM expenses e
  WHERE (p_date_from IS NULL OR e.date >= p_date_from)
    AND (p_date_to IS NULL OR e.date <= p_date_to)
    AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
    AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
    AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
    AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
    AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
    AND (
      exp_pattern IS NULL OR
      e.description ILIKE exp_pattern OR
      e.category ILIKE exp_pattern OR
      e.vehicle_number ILIKE exp_pattern OR
      e.person ILIKE exp_pattern OR
      e.paid_by_person ILIKE exp_pattern OR
      e.bill_receipt_ref ILIKE exp_pattern OR
      e.paid_by ILIKE exp_pattern
    );

  SELECT coalesce(sum(value), 0) INTO capital_total FROM capital_contributions;
  SELECT coalesce(sum(total_revenue), 0) INTO cash_revenue FROM trips;
  SELECT coalesce(sum(amount), 0) INTO cash_exp_revenue FROM expenses WHERE payment_source = 'Revenue';
  SELECT coalesce(sum(value), 0) INTO cash_cap_revenue
  FROM capital_contributions WHERE status = 'Paid' AND payment_source = 'Revenue';

  RETURN jsonb_build_object(
    'tripCount', trip_count,
    'totalRevenue', trip_revenue,
    'expenseCount', exp_count,
    'totalExpenses', exp_total,
    'jmTotal', jm_total,
    'maheshTotal', mahesh_total,
    'totalCapitalIn', capital_total,
    'cashAvailable', cash_revenue - cash_exp_revenue - cash_cap_revenue,
    'dailyTrips', coalesce((
      SELECT jsonb_agg(jsonb_build_object('date', d.date, 'revenue', d.revenue) ORDER BY d.date)
      FROM (
        SELECT t.date, sum(t.total_revenue) AS revenue
        FROM trips t
        WHERE (p_date_from IS NULL OR t.date >= p_date_from)
          AND (p_date_to IS NULL OR t.date <= p_date_to)
          AND (p_trip_vehicle IS NULL OR p_trip_vehicle = '' OR t.vehicle_number = p_trip_vehicle)
          AND (
            trip_pattern IS NULL OR
            t.vehicle_number ILIKE trip_pattern OR
            t.route_name ILIKE trip_pattern OR
            t.driver_name ILIKE trip_pattern
          )
        GROUP BY t.date
      ) d
    ), '[]'::jsonb),
    'dailyExpenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('date', d.date, 'expenses', d.expenses) ORDER BY d.date)
      FROM (
        SELECT e.date, sum(e.amount) AS expenses
        FROM expenses e
        WHERE (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
          AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
          AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
          AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
          AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
          AND (
            exp_pattern IS NULL OR
            e.description ILIKE exp_pattern OR
            e.category ILIKE exp_pattern OR
            e.vehicle_number ILIKE exp_pattern OR
            e.person ILIKE exp_pattern OR
            e.paid_by_person ILIKE exp_pattern OR
            e.bill_receipt_ref ILIKE exp_pattern OR
            e.paid_by ILIKE exp_pattern
          )
        GROUP BY e.date
      ) d
    ), '[]'::jsonb),
    'categoryBreakdown', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', c.category, 'value', c.total) ORDER BY c.total DESC)
      FROM (
        SELECT e.category, sum(e.amount) AS total
        FROM expenses e
        WHERE (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
          AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
          AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
          AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
          AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
          AND (
            exp_pattern IS NULL OR
            e.description ILIKE exp_pattern OR
            e.category ILIKE exp_pattern OR
            e.vehicle_number ILIKE exp_pattern OR
            e.person ILIKE exp_pattern OR
            e.paid_by_person ILIKE exp_pattern OR
            e.bill_receipt_ref ILIKE exp_pattern OR
            e.paid_by ILIKE exp_pattern
          )
        GROUP BY e.category
        HAVING sum(e.amount) > 0
      ) c
    ), '[]'::jsonb),
    'vehicleExpenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('vehicle', v.vehicle_number, 'amount', v.total) ORDER BY v.total DESC)
      FROM (
        SELECT e.vehicle_number, sum(e.amount) AS total
        FROM expenses e
        WHERE e.expense_type = 'vehicle'
          AND e.vehicle_number IS NOT NULL
          AND (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
          AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
          AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
          AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
          AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
          AND (
            exp_pattern IS NULL OR
            e.description ILIKE exp_pattern OR
            e.category ILIKE exp_pattern OR
            e.vehicle_number ILIKE exp_pattern OR
            e.person ILIKE exp_pattern OR
            e.paid_by_person ILIKE exp_pattern OR
            e.bill_receipt_ref ILIKE exp_pattern OR
            e.paid_by ILIKE exp_pattern
          )
        GROUP BY e.vehicle_number
      ) v
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_stats TO anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats TO authenticated;

-- Accounting reports RPCs (see also supabase/reports.sql)
-- p_date_from / p_date_to NULL = no bound (all time)

CREATE OR REPLACE FUNCTION public.monthly_pl_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_vehicle text DEFAULT NULL,
  p_entity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_count bigint;
  trip_revenue numeric;
  exp_total numeric;
  jm_total numeric;
  mahesh_total numeric;
BEGIN
  SELECT count(*)::bigint, coalesce(sum(total_revenue), 0)
  INTO trip_count, trip_revenue
  FROM trips t
  WHERE (p_date_from IS NULL OR t.date >= p_date_from)
    AND (p_date_to IS NULL OR t.date <= p_date_to)
    AND (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle);

  SELECT coalesce(sum(amount), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'JM transport'), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'Mahesh'), 0)
  INTO exp_total, jm_total, mahesh_total
  FROM expenses e
  WHERE (p_date_from IS NULL OR e.date >= p_date_from)
    AND (p_date_to IS NULL OR e.date <= p_date_to)
    AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
    AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity);

  RETURN jsonb_build_object(
    'tripCount', trip_count,
    'totalRevenue', trip_revenue,
    'totalExpenses', exp_total,
    'netProfit', trip_revenue - exp_total,
    'jmTotal', jm_total,
    'maheshTotal', mahesh_total,
    'expensesByType', coalesce((
      SELECT jsonb_agg(jsonb_build_object('type', x.expense_type, 'amount', x.total) ORDER BY x.total DESC)
      FROM (
        SELECT e.expense_type::text AS expense_type, sum(e.amount) AS total
        FROM expenses e
        WHERE (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        GROUP BY e.expense_type
        HAVING sum(e.amount) > 0
      ) x
    ), '[]'::jsonb),
    'expensesByCategory', coalesce((
      SELECT jsonb_agg(jsonb_build_object('category', x.category, 'amount', x.total) ORDER BY x.total DESC)
      FROM (
        SELECT e.category, sum(e.amount) AS total
        FROM expenses e
        WHERE (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        GROUP BY e.category
        HAVING sum(e.amount) > 0
      ) x
    ), '[]'::jsonb),
    'expensesByEntity', coalesce((
      SELECT jsonb_agg(jsonb_build_object('entity', x.paid_by, 'amount', x.total) ORDER BY x.total DESC)
      FROM (
        SELECT e.paid_by, sum(e.amount) AS total
        FROM expenses e
        WHERE (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        GROUP BY e.paid_by
        HAVING sum(e.amount) > 0
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vehicle_pl_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_entity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'vehicles', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'vehicle', v.vehicle_number,
          'tripCount', coalesce(tr.trip_count, 0),
          'totalWeight', coalesce(tr.total_weight, 0),
          'revenue', coalesce(tr.revenue, 0),
          'vehicleExpenses', coalesce(ex.expenses, 0),
          'netProfit', coalesce(tr.revenue, 0) - coalesce(ex.expenses, 0)
        )
        ORDER BY coalesce(tr.revenue, 0) - coalesce(ex.expenses, 0) DESC
      )
      FROM vehicles v
      LEFT JOIN (
        SELECT vehicle_number,
               count(*)::bigint AS trip_count,
               coalesce(sum(weight_tons), 0) AS total_weight,
               coalesce(sum(total_revenue), 0) AS revenue
        FROM trips
        WHERE (p_date_from IS NULL OR date >= p_date_from)
          AND (p_date_to IS NULL OR date <= p_date_to)
        GROUP BY vehicle_number
      ) tr ON tr.vehicle_number = v.vehicle_number
      LEFT JOIN (
        SELECT vehicle_number, coalesce(sum(amount), 0) AS expenses
        FROM expenses
        WHERE (p_date_from IS NULL OR date >= p_date_from)
          AND (p_date_to IS NULL OR date <= p_date_to)
          AND expense_type = 'vehicle'
          AND vehicle_number IS NOT NULL
          AND (p_entity IS NULL OR p_entity = '' OR paid_by = p_entity)
        GROUP BY vehicle_number
      ) ex ON ex.vehicle_number = v.vehicle_number
      WHERE coalesce(tr.trip_count, 0) > 0 OR coalesce(ex.expenses, 0) > 0
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.daily_trip_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_vehicle text DEFAULT NULL,
  p_entity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
BEGIN
  v_from := p_date_from;
  v_to := p_date_to;

  IF v_from IS NULL THEN
    SELECT min(d) INTO v_from FROM (
      SELECT min(t.date) AS d FROM trips t
        WHERE (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle)
      UNION ALL
      SELECT min(e.date) FROM expenses e
        WHERE e.expense_type = 'vehicle'
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
    ) bounds WHERE d IS NOT NULL;
  END IF;

  IF v_to IS NULL THEN
    SELECT max(d) INTO v_to FROM (
      SELECT max(t.date) AS d FROM trips t
        WHERE (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle)
      UNION ALL
      SELECT max(e.date) FROM expenses e
        WHERE e.expense_type = 'vehicle'
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
    ) bounds WHERE d IS NOT NULL;
  END IF;

  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN jsonb_build_object('days', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'days', coalesce((
      SELECT jsonb_agg(day_row ORDER BY day_row->>'date')
      FROM (
        SELECT jsonb_build_object(
          'date', d.day,
          'tripCount', coalesce(tr.trip_count, 0),
          'totalWeight', coalesce(tr.total_weight, 0),
          'revenue', coalesce(tr.revenue, 0),
          'vehicleExpenses', coalesce(ex.expenses, 0),
          'netProfit', coalesce(tr.revenue, 0) - coalesce(ex.expenses, 0),
          'trips', coalesce(tr.trips, '[]'::jsonb),
          'expenses', coalesce(ex.expense_rows, '[]'::jsonb)
        ) AS day_row
        FROM (
          SELECT generate_series(v_from, v_to, '1 day'::interval)::date AS day
        ) d
        LEFT JOIN LATERAL (
          SELECT count(*)::bigint AS trip_count,
                 coalesce(sum(weight_tons), 0) AS total_weight,
                 coalesce(sum(total_revenue), 0) AS revenue,
                 coalesce(jsonb_agg(
                   jsonb_build_object(
                     'id', t.id,
                     'vehicle_number', t.vehicle_number,
                     'route_name', t.route_name,
                     'driver_name', t.driver_name,
                     'weight_tons', t.weight_tons,
                     'rate_per_ton', t.rate_per_ton,
                     'total_revenue', t.total_revenue,
                     'advance_paid', t.advance_paid,
                     'balance_due', t.balance_due
                   ) ORDER BY t.id
                 ), '[]'::jsonb) AS trips
          FROM trips t
          WHERE t.date = d.day
            AND (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle)
        ) tr ON true
        LEFT JOIN LATERAL (
          SELECT coalesce(sum(e.amount), 0) AS expenses,
                 coalesce(jsonb_agg(
                   jsonb_build_object(
                     'vehicle_number', e.vehicle_number,
                     'category', e.category,
                     'amount', e.amount,
                     'description', e.description
                   ) ORDER BY e.id
                 ), '[]'::jsonb) AS expense_rows
          FROM expenses e
          WHERE e.date = d.day
            AND e.expense_type = 'vehicle'
            AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
            AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        ) ex ON true
        WHERE coalesce(tr.trip_count, 0) > 0 OR coalesce(ex.expenses, 0) > 0
      ) sub
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.monthly_pl_report TO anon;
GRANT EXECUTE ON FUNCTION public.monthly_pl_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.vehicle_pl_report TO anon;
GRANT EXECUTE ON FUNCTION public.vehicle_pl_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_trip_report TO anon;
GRANT EXECUTE ON FUNCTION public.daily_trip_report TO authenticated;

-- Driver payroll columns (see supabase/driver_payroll.sql for existing DBs)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS left_date DATE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 25000;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS daily_allowance DECIMAL(12,2) NOT NULL DEFAULT 500;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS settlement_notes TEXT;

-- Driver leave days (see supabase/driver_payroll.sql)
CREATE TABLE IF NOT EXISTS driver_leave (
  id SERIAL PRIMARY KEY,
  driver_name TEXT NOT NULL REFERENCES drivers(name),
  date DATE NOT NULL,
  notes TEXT,
  deduct_salary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_name, date)
);

ALTER TABLE driver_leave ADD COLUMN IF NOT EXISTS deduct_salary BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_driver_leave_date ON driver_leave(date);
CREATE INDEX IF NOT EXISTS idx_driver_leave_driver ON driver_leave(driver_name);

ALTER TABLE driver_leave ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on driver_leave" ON driver_leave;
CREATE POLICY "Allow all on driver_leave" ON driver_leave FOR ALL USING (true) WITH CHECK (true);

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
