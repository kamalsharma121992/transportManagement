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

-- Enable Row Level Security (open for now - add auth policies later)
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_information ENABLE ROW LEVEL SECURITY;

-- Allow public access (no auth required for now)
CREATE POLICY "Allow all on partners" ON partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on routes" ON routes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on trips" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on capital_contributions" ON capital_contributions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on banking_information" ON banking_information FOR ALL USING (true) WITH CHECK (true);
