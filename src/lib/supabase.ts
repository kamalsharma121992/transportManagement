import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export const supabase = typeof window !== 'undefined'
  ? getSupabase()
  : (new Proxy({} as SupabaseClient, {
      get: () => () => ({ data: null, error: null }),
    }));

export type Vehicle = {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
  model: string | null;
  capacity_tons: number | null;
  chassis_number: string | null;
  insurance_expiry: string | null;
  permit_expiry: string | null;
  puc_expiry: string | null;
};

export type Route = {
  id: number;
  origin: string;
  destination: string;
  route_name: string;
  distance_km: number;
  standard_rate_per_ton: number;
};

export type Driver = {
  id: number;
  name: string;
  phone: string | null;
};

export type Partner = {
  id: number;
  name: string;
};

export type Trip = {
  id: number;
  date: string;
  vehicle_number: string;
  route_name: string;
  driver_name: string;
  weight_tons: number;
  distance_km: number;
  rate_per_ton: number;
  total_revenue: number;
  advance_paid: number;
  balance_due: number;
};

export type ExpenseType = 'vehicle' | 'operational' | 'personal' | 'other';

export type Expense = {
  id: number;
  date: string;
  expense_type: ExpenseType;
  vehicle_number: string | null;
  category: string;
  amount: number;
  description: string | null;
  person: string | null;
  paid_by_person: string | null;
  bill_receipt_ref: string | null;
  paid_by: string;
  status: string;
};

export type CapitalContribution = {
  id: number;
  date: string;
  contributor: string;
  contribution_type: string;
  value: number;
  description: string | null;
  asset_details: string | null;
  status: string;
  paid_date: string | null;
  paid_by: string;
};

export const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'operational', label: 'Operational' },
  { value: 'personal', label: 'Personal' },
];

export const CATEGORIES_BY_TYPE: Record<ExpenseType, string[]> = {
  vehicle: ['Fuel (Diesel)', 'Toll Taxes', 'Maintenance', 'Insurance', 'EMI / Loan Payments', 'Driver Salary', 'Others'],
  operational: ['Meals', 'Hotel Stay', 'Rent', 'Supplies', 'Daily Allowance', 'Advance', 'Salary', 'Partner Allowance'],
  personal: ['Personal Care', 'Other'],
  other: ['Other'],
};

export const ALL_CATEGORIES = [
  'Fuel (Diesel)', 'Toll Taxes', 'Maintenance', 'Insurance', 'EMI / Loan Payments',
  'Driver Salary', 'Meals', 'Hotel Stay', 'Rent', 'Supplies', 'Daily Allowance',
  'Advance', 'Salary', 'Partner Allowance', 'Personal Care', 'Others', 'Other',
] as const;

// 2 paying entities
export const PAID_BY_ENTITIES = ['JM transport', 'Mahesh'] as const;

// JM Transport partners (who pay and contribute capital)
export const JM_PARTNERS = ['Kamal', 'Bimal', 'Subham', 'Mohit'] as const;
