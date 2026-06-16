import { supabase } from '@/lib/supabase';
import { buildTextSearchFilter, EXPENSE_SEARCH_COLUMNS, TRIP_SEARCH_COLUMNS } from '@/lib/search';

export type DashboardStats = {
  tripCount: number;
  totalRevenue: number;
  expenseCount: number;
  totalExpenses: number;
  jmTotal: number;
  maheshTotal: number;
  totalCapitalIn: number;
  cashAvailable: number;
  dailyTrips: { date: string; revenue: number }[];
  dailyExpenses: { date: string; expenses: number }[];
  categoryBreakdown: { name: string; value: number }[];
  vehicleExpenses: { vehicle: string; amount: number }[];
};

export type DashboardFilterParams = {
  dateFrom: string | null;
  dateTo: string | null;
  tripVehicle: string | null;
  tripSearch: string | null;
  expPaidBy: string | null;
  expPaidByPerson: string | null;
  expPerson: string | null;
  expVehicle: string | null;
  expPaymentSource: string | null;
  expSearch: string | null;
};

export function getDashboardDateRange(
  filterMonth: string,
  filterDateFrom: string,
  filterDateTo: string,
): { dateFrom: string | null; dateTo: string | null } {
  if (filterMonth) {
    const [y, m] = filterMonth.split('-');
    const start = `${y}-${m}-01`;
    const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
    return { dateFrom: start, dateTo: end };
  }
  return {
    dateFrom: filterDateFrom || null,
    dateTo: filterDateTo || null,
  };
}

function emptyStats(): DashboardStats {
  return {
    tripCount: 0,
    totalRevenue: 0,
    expenseCount: 0,
    totalExpenses: 0,
    jmTotal: 0,
    maheshTotal: 0,
    totalCapitalIn: 0,
    cashAvailable: 0,
    dailyTrips: [],
    dailyExpenses: [],
    categoryBreakdown: [],
    vehicleExpenses: [],
  };
}

function num(v: unknown): number {
  return Number(v) || 0;
}

function parseStats(raw: Record<string, unknown>): DashboardStats {
  return {
    tripCount: num(raw.tripCount),
    totalRevenue: num(raw.totalRevenue),
    expenseCount: num(raw.expenseCount),
    totalExpenses: num(raw.totalExpenses),
    jmTotal: num(raw.jmTotal),
    maheshTotal: num(raw.maheshTotal),
    totalCapitalIn: num(raw.totalCapitalIn),
    cashAvailable: num(raw.cashAvailable),
    dailyTrips: Array.isArray(raw.dailyTrips)
      ? raw.dailyTrips.map((r: { date: string; revenue: unknown }) => ({
          date: r.date,
          revenue: num(r.revenue),
        }))
      : [],
    dailyExpenses: Array.isArray(raw.dailyExpenses)
      ? raw.dailyExpenses.map((r: { date: string; expenses: unknown }) => ({
          date: r.date,
          expenses: num(r.expenses),
        }))
      : [],
    categoryBreakdown: Array.isArray(raw.categoryBreakdown)
      ? raw.categoryBreakdown.map((r: { name: string; value: unknown }) => ({
          name: r.name,
          value: num(r.value),
        }))
      : [],
    vehicleExpenses: Array.isArray(raw.vehicleExpenses)
      ? raw.vehicleExpenses.map((r: { vehicle: string; amount: unknown }) => ({
          vehicle: r.vehicle,
          amount: num(r.amount),
        }))
      : [],
  };
}

export function mergeDailySeries(
  dailyTrips: DashboardStats['dailyTrips'],
  dailyExpenses: DashboardStats['dailyExpenses'],
) {
  const dateMap: Record<string, { revenue: number; expenses: number }> = {};
  dailyTrips.forEach((t) => {
    if (!dateMap[t.date]) dateMap[t.date] = { revenue: 0, expenses: 0 };
    dateMap[t.date].revenue += t.revenue;
  });
  dailyExpenses.forEach((e) => {
    if (!dateMap[e.date]) dateMap[e.date] = { revenue: 0, expenses: 0 };
    dateMap[e.date].expenses += e.expenses;
  });
  return Object.entries(dateMap)
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildTripFilterQuery(filters: DashboardFilterParams) {
  type Q = {
    gte: (col: string, val: string) => Q;
    lte: (col: string, val: string) => Q;
    eq: (col: string, val: string) => Q;
    or: (filter: string) => Q;
    select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => Promise<{ count: number | null; data: unknown; error: { message: string } | null }>;
  };
  let q = supabase.from('trips') as unknown as Q;
  if (filters.dateFrom) q = q.gte('date', filters.dateFrom);
  if (filters.dateTo) q = q.lte('date', filters.dateTo);
  if (filters.tripVehicle) q = q.eq('vehicle_number', filters.tripVehicle);
  const searchFilter = buildTextSearchFilter([...TRIP_SEARCH_COLUMNS], filters.tripSearch || '');
  if (searchFilter) q = q.or(searchFilter);
  return q;
}

function buildExpenseFilterQuery(filters: DashboardFilterParams) {
  type Q = {
    gte: (col: string, val: string) => Q;
    lte: (col: string, val: string) => Q;
    eq: (col: string, val: string) => Q;
    or: (filter: string) => Q;
    select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => Promise<{ count: number | null; data: unknown; error: { message: string } | null }>;
  };
  let q = supabase.from('expenses') as unknown as Q;
  if (filters.dateFrom) q = q.gte('date', filters.dateFrom);
  if (filters.dateTo) q = q.lte('date', filters.dateTo);
  if (filters.expPaidBy) q = q.eq('paid_by', filters.expPaidBy);
  if (filters.expPaidByPerson) q = q.eq('paid_by_person', filters.expPaidByPerson);
  if (filters.expPerson) q = q.eq('person', filters.expPerson);
  if (filters.expVehicle) q = q.eq('vehicle_number', filters.expVehicle);
  if (filters.expPaymentSource) q = q.eq('payment_source', filters.expPaymentSource);
  const searchFilter = buildTextSearchFilter([...EXPENSE_SEARCH_COLUMNS], filters.expSearch || '');
  if (searchFilter) q = q.or(searchFilter);
  return q;
}

/** Fallback when dashboard_stats RPC is not deployed — fetches slim columns only */
async function fetchDashboardStatsFallback(
  filters: DashboardFilterParams,
): Promise<{ data: DashboardStats | null; error: string | null }> {
  const [
    { count: tripCount },
    { data: tripRows, error: tripError },
    { count: expenseCount },
    { data: expenseRows, error: expError },
    { data: capitalRows },
    { data: allTripRevenue },
    { data: allExpRevenue },
    { data: capPaidRows },
  ] = await Promise.all([
    buildTripFilterQuery(filters).select('*', { count: 'exact', head: true }),
    buildTripFilterQuery(filters).select('date, total_revenue'),
    buildExpenseFilterQuery(filters).select('*', { count: 'exact', head: true }),
    buildExpenseFilterQuery(filters).select('date, amount, category, paid_by, expense_type, vehicle_number'),
    supabase.from('capital_contributions').select('value'),
    supabase.from('trips').select('total_revenue'),
    supabase.from('expenses').select('amount, payment_source'),
    supabase.from('capital_contributions').select('value, status, payment_source'),
  ]);

  if (tripError) return { data: null, error: tripError.message };
  if (expError) return { data: null, error: expError.message };

  const trips = (tripRows || []) as { date: string; total_revenue: number }[];
  const expenses = (expenseRows || []) as {
    date: string;
    amount: number;
    category: string;
    paid_by: string;
    expense_type: string;
    vehicle_number: string | null;
  }[];

  const dailyTripMap: Record<string, number> = {};
  let totalRevenue = 0;
  trips.forEach((t) => {
    totalRevenue += num(t.total_revenue);
    dailyTripMap[t.date] = (dailyTripMap[t.date] || 0) + num(t.total_revenue);
  });

  const dailyExpMap: Record<string, number> = {};
  const catMap: Record<string, number> = {};
  const vehMap: Record<string, number> = {};
  let totalExpenses = 0;
  let jmTotal = 0;
  let maheshTotal = 0;
  expenses.forEach((e) => {
    const amt = num(e.amount);
    totalExpenses += amt;
    dailyExpMap[e.date] = (dailyExpMap[e.date] || 0) + amt;
    catMap[e.category] = (catMap[e.category] || 0) + amt;
    if (e.paid_by === 'JM transport') jmTotal += amt;
    if (e.paid_by === 'Mahesh') maheshTotal += amt;
    if (e.expense_type === 'vehicle' && e.vehicle_number) {
      vehMap[e.vehicle_number] = (vehMap[e.vehicle_number] || 0) + amt;
    }
  });

  const allRevenue = (allTripRevenue || []).reduce((s, r) => s + num(r.total_revenue), 0);
  const allExpFromRevenue = (allExpRevenue || [])
    .filter((r) => r.payment_source === 'Revenue')
    .reduce((s, r) => s + num(r.amount), 0);
  const capPaidFromRevenue = (capPaidRows || [])
    .filter((r) => r.status === 'Paid' && r.payment_source === 'Revenue')
    .reduce((s, r) => s + num(r.value), 0);

  return {
    data: {
      tripCount: tripCount ?? 0,
      totalRevenue,
      expenseCount: expenseCount ?? 0,
      totalExpenses,
      jmTotal,
      maheshTotal,
      totalCapitalIn: (capitalRows || []).reduce((s, r) => s + num(r.value), 0),
      cashAvailable: allRevenue - allExpFromRevenue - capPaidFromRevenue,
      dailyTrips: Object.entries(dailyTripMap).map(([date, revenue]) => ({ date, revenue })),
      dailyExpenses: Object.entries(dailyExpMap).map(([date, expenses]) => ({ date, expenses })),
      categoryBreakdown: Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value),
      vehicleExpenses: Object.entries(vehMap)
        .map(([vehicle, amount]) => ({ vehicle, amount }))
        .sort((a, b) => b.amount - a.amount),
    },
    error: null,
  };
}

export async function fetchDashboardStats(
  filters: DashboardFilterParams,
): Promise<{ data: DashboardStats | null; error: string | null }> {
  const { data, error } = await supabase.rpc('dashboard_stats', {
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_trip_vehicle: filters.tripVehicle || null,
    p_trip_search: filters.tripSearch?.trim() || null,
    p_exp_paid_by: filters.expPaidBy || null,
    p_exp_paid_by_person: filters.expPaidByPerson || null,
    p_exp_person: filters.expPerson || null,
    p_exp_vehicle: filters.expVehicle || null,
    p_exp_payment_source: filters.expPaymentSource || null,
    p_exp_search: filters.expSearch?.trim() || null,
  });

  if (error) {
    if (error.message.includes('dashboard_stats') || error.message.includes('schema cache')) {
      return fetchDashboardStatsFallback(filters);
    }
    return { data: null, error: error.message };
  }
  if (!data || typeof data !== 'object') return { data: emptyStats(), error: null };
  return { data: parseStats(data as Record<string, unknown>), error: null };
}
