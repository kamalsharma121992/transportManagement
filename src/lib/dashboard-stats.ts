import { supabase, EXPENSE_ADVANCE_CATEGORY } from '@/lib/supabase';
import { getMonthDateRange } from '@/lib/format';
import { applyInFilter, hasMultiValueFilters } from '@/lib/filter-helpers';
import { buildTextSearchFilter, EXPENSE_SEARCH_COLUMNS, TRIP_SEARCH_COLUMNS } from '@/lib/search';

export type DashboardStats = {
  tripCount: number;
  totalRevenue: number;
  pendingRevenue: number;
  collectedRevenue: number;
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
  tripVehicles: string[];
  tripSearch: string | null;
  expPaidBy: string[];
  expPaidByPerson: string[];
  expPerson: string[];
  expVehicles: string[];
  expPaymentSources: string[];
  expSearch: string | null;
};

export function getDashboardDateRange(
  filterMonth: string,
  filterDateFrom: string,
  filterDateTo: string,
): { dateFrom: string | null; dateTo: string | null } {
  if (filterMonth) {
    const { from, to } = getMonthDateRange(filterMonth);
    return { dateFrom: from, dateTo: to };
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
    pendingRevenue: 0,
    collectedRevenue: 0,
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
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type TripPaymentRow = {
  total_revenue: number;
  payment_status: string;
  advance_paid: number | null;
  balance_due: number | null;
};

function tripPaymentAmounts(trips: TripPaymentRow[]) {
  let pendingRevenue = 0;
  let collectedRevenue = 0;
  trips.forEach((t) => {
    if (t.payment_status === 'Fully Paid') {
      collectedRevenue += num(t.total_revenue);
    } else {
      pendingRevenue += num(t.balance_due);
      collectedRevenue += num(t.advance_paid);
    }
  });
  return { pendingRevenue, collectedRevenue };
}

function parseStats(raw: Record<string, unknown>): DashboardStats {
  return {
    tripCount: num(raw.tripCount),
    totalRevenue: num(raw.totalRevenue),
    pendingRevenue: num(raw.pendingRevenue),
    collectedRevenue: num(raw.collectedRevenue),
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

type FilterableQuery = {
  gte: (col: string, val: string) => FilterableQuery;
  lte: (col: string, val: string) => FilterableQuery;
  eq: (col: string, val: string) => FilterableQuery;
  neq: (col: string, val: string) => FilterableQuery;
  in: (col: string, vals: string[]) => FilterableQuery;
  or: (filter: string) => FilterableQuery;
};

function applyDashboardTripFilters<Q>(query: Q, filters: DashboardFilterParams): Q {
  let q = query as Q & FilterableQuery;
  if (filters.dateFrom) q = q.gte('date', filters.dateFrom) as typeof q;
  if (filters.dateTo) q = q.lte('date', filters.dateTo) as typeof q;
  q = applyInFilter(q, 'vehicle_number', filters.tripVehicles) as typeof q;
  const searchFilter = buildTextSearchFilter([...TRIP_SEARCH_COLUMNS], filters.tripSearch || '');
  if (searchFilter) q = q.or(searchFilter) as typeof q;
  return q as Q;
}

function applyDashboardExpenseFilters<Q>(query: Q, filters: DashboardFilterParams): Q {
  let q = query as Q & FilterableQuery;
  q = q.neq('category', EXPENSE_ADVANCE_CATEGORY) as typeof q;
  if (filters.dateFrom) q = q.gte('date', filters.dateFrom) as typeof q;
  if (filters.dateTo) q = q.lte('date', filters.dateTo) as typeof q;
  q = applyInFilter(q, 'paid_by', filters.expPaidBy) as typeof q;
  q = applyInFilter(q, 'paid_by_person', filters.expPaidByPerson) as typeof q;
  q = applyInFilter(q, 'person', filters.expPerson) as typeof q;
  q = applyInFilter(q, 'vehicle_number', filters.expVehicles) as typeof q;
  q = applyInFilter(q, 'payment_source', filters.expPaymentSources) as typeof q;
  const searchFilter = buildTextSearchFilter([...EXPENSE_SEARCH_COLUMNS], filters.expSearch || '');
  if (searchFilter) q = q.or(searchFilter) as typeof q;
  return q as Q;
}

function tripPaymentQuery(filters: DashboardFilterParams) {
  return applyDashboardTripFilters(
    supabase.from('trips').select('total_revenue, payment_status, advance_paid, balance_due'),
    filters,
  );
}

async function fetchTripPaymentAmounts(
  filters: DashboardFilterParams,
): Promise<{ pendingRevenue: number; collectedRevenue: number; error: string | null }> {
  const { data, error } = await tripPaymentQuery(filters);
  if (error) return { pendingRevenue: 0, collectedRevenue: 0, error: error.message };
  return { ...tripPaymentAmounts((data || []) as TripPaymentRow[]), error: null };
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
    applyDashboardTripFilters(supabase.from('trips').select('*', { count: 'exact', head: true }), filters),
    applyDashboardTripFilters(
      supabase.from('trips').select('date, total_revenue, payment_status, advance_paid, balance_due'),
      filters,
    ),
    applyDashboardExpenseFilters(supabase.from('expenses').select('*', { count: 'exact', head: true }), filters),
    applyDashboardExpenseFilters(
      supabase.from('expenses').select('date, amount, category, paid_by, expense_type, vehicle_number'),
      filters,
    ),
    supabase.from('capital_contributions').select('value'),
    supabase.from('trips').select('total_revenue, payment_status, advance_paid'),
    supabase.from('expenses').select('amount, payment_source, category').neq('category', EXPENSE_ADVANCE_CATEGORY),
    supabase.from('capital_contributions').select('value, status, payment_source'),
  ]);

  if (tripError) return { data: null, error: tripError.message };
  if (expError) return { data: null, error: expError.message };

  const trips = (tripRows || []) as ({ date: string } & TripPaymentRow)[];
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
  const { pendingRevenue, collectedRevenue } = tripPaymentAmounts(trips);

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

  const allRevenue = (allTripRevenue || []).reduce((s, r) => {
    const row = r as { total_revenue: number; payment_status: string; advance_paid: number };
    if (row.payment_status === 'Fully Paid') return s + num(row.total_revenue);
    return s + num(row.advance_paid);
  }, 0);
  const allExpFromRevenue = (allExpRevenue || [])
    .filter((r) => r.payment_source === 'Revenue' && r.category !== EXPENSE_ADVANCE_CATEGORY)
    .reduce((s, r) => s + num(r.amount), 0);
  const capPaidFromRevenue = (capPaidRows || [])
    .filter((r) => r.status === 'Paid' && r.payment_source === 'Revenue')
    .reduce((s, r) => s + num(r.value), 0);

  return {
    data: {
      tripCount: tripCount ?? 0,
      totalRevenue,
      pendingRevenue,
      collectedRevenue,
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
  const useFallback = hasMultiValueFilters(
    filters.tripVehicles,
    filters.expPaidBy,
    filters.expPaidByPerson,
    filters.expPerson,
    filters.expVehicles,
    filters.expPaymentSources,
  );

  if (!useFallback) {
    const { data, error } = await supabase.rpc('dashboard_stats', {
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_trip_vehicle: filters.tripVehicles[0] || null,
      p_trip_search: filters.tripSearch?.trim() || null,
      p_exp_paid_by: filters.expPaidBy[0] || null,
      p_exp_paid_by_person: filters.expPaidByPerson[0] || null,
      p_exp_person: filters.expPerson[0] || null,
      p_exp_vehicle: filters.expVehicles[0] || null,
      p_exp_payment_source: filters.expPaymentSources[0] || null,
      p_exp_search: filters.expSearch?.trim() || null,
    });

    if (!error && data) {
      const stats = parseStats(data as Record<string, unknown>);
      const payments = await fetchTripPaymentAmounts(filters);
      if (payments.error) return { data: null, error: payments.error };
      return {
        data: {
          ...stats,
          pendingRevenue: payments.pendingRevenue,
          collectedRevenue: payments.collectedRevenue,
        },
        error: null,
      };
    }
    if (error && !error.message.includes('dashboard_stats') && !error.message.includes('schema cache')) {
      return { data: null, error: error.message };
    }
  }

  return fetchDashboardStatsFallback(filters);
}
