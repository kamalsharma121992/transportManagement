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
  commission: number;
};

export type Driver = {
  id: number;
  name: string;
  phone: string | null;
  status?: string;
  joined_date?: string | null;
  left_date?: string | null;
  monthly_salary?: number;
  daily_allowance?: number;
  settlement_notes?: string | null;
};

export const DRIVER_PAY_CATEGORIES = {
  allowance: 'Daily Allowance',
  salary: 'Salary',
  advance: 'Advance',
} as const;

/** Cash float for driver/partner spend; settled on /expense-advances */
export const EXPENSE_ADVANCE_CATEGORY = 'Expense Advance' as const;
/** @deprecated use EXPENSE_ADVANCE_CATEGORY */
export const TRIP_ADVANCE_CATEGORY = EXPENSE_ADVANCE_CATEGORY;

export const EXPENSE_ADVANCE_STATUSES = ['Open', 'Partial', 'Settled'] as const;
export type ExpenseAdvanceStatus = (typeof EXPENSE_ADVANCE_STATUSES)[number];
/** @deprecated use ExpenseAdvanceStatus */
export type TripAdvanceStatus = ExpenseAdvanceStatus;

export type ExpenseAdvance = {
  id: number;
  date: string;
  person: string;
  amount: number;
  notes: string | null;
  status: ExpenseAdvanceStatus;
  source_expense_id: number | null;
  created_at?: string;
};
/** @deprecated use ExpenseAdvance */
export type TripAdvance = ExpenseAdvance;

export const TRIP_ADVANCE_STATUSES = EXPENSE_ADVANCE_STATUSES;

export const SALARY_CATEGORIES = ['Salary', 'Driver Salary'] as const;

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
  commission: number;
  advance_paid: number;
  balance_due: number;
  payment_status: TripPaymentStatus;
  payment_expected_date: string | null;
  notes: string | null;
};

export const TRIP_PAYMENT_STATUSES = ['Fully Paid', 'Pending'] as const;
export type TripPaymentStatus = (typeof TRIP_PAYMENT_STATUSES)[number];

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
  payment_source: string | null;
  card_id: number | null;
  expense_advance_id: number | null;
};

export type CreditCard = {
  id: number;
  holder: string;
  bank_name: string;
  network: string;
  last_four: string;
  label: string;
  is_active: boolean;
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
  payment_source: string | null;
  card_id: number | null;
};

export const EXPENSE_TYPES: { value: ExpenseType; label: string }[] = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'operational', label: 'Operational' },
  { value: 'personal', label: 'Personal' },
];

export {
  DEFAULT_CATEGORIES_BY_TYPE as CATEGORIES_BY_TYPE,
  DEFAULT_ALL_CATEGORIES as ALL_CATEGORIES,
} from './expense-categories';

// 2 paying entities
export const PAID_BY_ENTITIES = ['JM transport', 'Mahesh'] as const;

// JM Transport partners (who pay and contribute capital)
export const JM_PARTNERS = ['Kamal', 'Bimal', 'Subham', 'Mohit'] as const;

// Payment sources for tracking cash flow
export const PAYMENT_SOURCES = ['Partner', 'Revenue', 'Kamal', 'Bimal', 'Subham', 'Mohit'] as const;
