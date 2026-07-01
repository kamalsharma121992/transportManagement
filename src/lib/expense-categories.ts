export type ExpenseType = 'vehicle' | 'operational' | 'personal' | 'other';

export const FUEL_CATEGORY = 'Fuel (Diesel)';

export function paymentModeForCategory(category: string): 'Cash' | 'Credit Card' {
  return category === FUEL_CATEGORY ? 'Credit Card' : 'Cash';
}

export type ExpenseCategory = {
  id: number;
  name: string;
  expense_type: ExpenseType;
  sort_order: number;
};

export const DEFAULT_CATEGORIES_BY_TYPE: Record<ExpenseType, string[]> = {
  vehicle: ['Fuel (Diesel)', 'Toll Taxes', 'Maintenance', 'Insurance', 'EMI / Loan Payments', 'Driver Salary', 'Others'],
  operational: ['Meals', 'Hotel Stay', 'Rent', 'Supplies', 'Daily Allowance', 'Advance', 'Salary', 'Partner Allowance', 'Office Expense', 'Credit Card Payment'],
  personal: ['Personal Care', 'Other'],
  other: ['Other'],
};

export const DEFAULT_ALL_CATEGORIES = [
  ...DEFAULT_CATEGORIES_BY_TYPE.vehicle,
  ...DEFAULT_CATEGORIES_BY_TYPE.operational,
  ...DEFAULT_CATEGORIES_BY_TYPE.personal,
  ...DEFAULT_CATEGORIES_BY_TYPE.other,
];

export function buildCategoriesByType(
  rows: Pick<ExpenseCategory, 'name' | 'expense_type'>[],
): Record<ExpenseType, string[]> {
  const map: Record<ExpenseType, string[]> = {
    vehicle: [],
    operational: [],
    personal: [],
    other: [],
  };
  for (const row of rows) {
    map[row.expense_type].push(row.name);
  }
  return map;
}

export function buildAllCategoryNames(byType: Record<ExpenseType, string[]>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const type of ['vehicle', 'operational', 'personal', 'other'] as ExpenseType[]) {
    for (const name of byType[type]) {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }
  return names;
}

function defaultCategoryRows(): ExpenseCategory[] {
  let id = 1;
  const rows: ExpenseCategory[] = [];
  for (const expenseType of ['vehicle', 'operational', 'personal', 'other'] as ExpenseType[]) {
    DEFAULT_CATEGORIES_BY_TYPE[expenseType].forEach((name, index) => {
      rows.push({ id: id++, name, expense_type: expenseType, sort_order: index + 1 });
    });
  }
  return rows;
}

export async function fetchExpenseCategories(): Promise<{
  data: ExpenseCategory[];
  error: string | null;
}> {
  const { getSupabase } = await import('@/lib/supabase');
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, name, expense_type, sort_order')
    .order('expense_type')
    .order('sort_order')
    .order('name');

  if (error) {
    if (error.message.includes('expense_categories') || error.message.includes('schema cache')) {
      return { data: defaultCategoryRows(), error: null };
    }
    return { data: defaultCategoryRows(), error: error.message };
  }

  if (!data?.length) {
    return { data: defaultCategoryRows(), error: null };
  }

  return { data: data as ExpenseCategory[], error: null };
}
