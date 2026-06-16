import { supabase } from '@/lib/supabase';
import { getDashboardDateRange } from '@/lib/dashboard-stats';

export type ReportFilterParams = {
  dateFrom: string | null;
  dateTo: string | null;
  vehicle: string | null;
  entity: string | null;
};

export type MonthlyPlReport = {
  tripCount: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  jmTotal: number;
  maheshTotal: number;
  expensesByType: { type: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
  expensesByEntity: { entity: string; amount: number }[];
};

export type VehiclePlRow = {
  vehicle: string;
  tripCount: number;
  totalWeight: number;
  revenue: number;
  vehicleExpenses: number;
  netProfit: number;
};

export type DailyTripLine = {
  id: number;
  vehicle_number: string;
  route_name: string;
  driver_name: string;
  weight_tons: number;
  rate_per_ton: number;
  total_revenue: number;
  advance_paid: number;
  balance_due: number;
};

export type DailyExpenseLine = {
  vehicle_number: string | null;
  category: string;
  amount: number;
  description: string | null;
};

export type DailyTripDay = {
  date: string;
  tripCount: number;
  totalWeight: number;
  revenue: number;
  vehicleExpenses: number;
  netProfit: number;
  trips: DailyTripLine[];
  expenses: DailyExpenseLine[];
};

export function buildReportFilters(
  filterMonth: string,
  filterDateFrom: string,
  filterDateTo: string,
  filterVehicle: string,
  filterEntity: string,
): ReportFilterParams {
  const { dateFrom, dateTo } = getDashboardDateRange(filterMonth, filterDateFrom, filterDateTo);
  return {
    dateFrom,
    dateTo,
    vehicle: filterVehicle || null,
    entity: filterEntity || null,
  };
}

type DateRangedQuery = {
  gte(column: string, value: string): DateRangedQuery;
  lte(column: string, value: string): DateRangedQuery;
};

function applyReportDateRange<T extends DateRangedQuery>(q: T, dateFrom: string | null, dateTo: string | null): T {
  let query = q;
  if (dateFrom) query = query.gte('date', dateFrom) as T;
  if (dateTo) query = query.lte('date', dateTo) as T;
  return query;
}

function num(v: unknown): number {
  return Number(v) || 0;
}

export async function fetchMonthlyPlReport(filters: ReportFilterParams): Promise<MonthlyPlReport> {
  const { data, error } = await supabase.rpc('monthly_pl_report', {
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_vehicle: filters.vehicle,
    p_entity: filters.entity,
  });

  if (!error && data) {
    const d = data as Record<string, unknown>;
    return {
      tripCount: num(d.tripCount),
      totalRevenue: num(d.totalRevenue),
      totalExpenses: num(d.totalExpenses),
      netProfit: num(d.netProfit),
      jmTotal: num(d.jmTotal),
      maheshTotal: num(d.maheshTotal),
      expensesByType: ((d.expensesByType as { type: string; amount: number }[]) || []).map((r) => ({
        type: r.type,
        amount: num(r.amount),
      })),
      expensesByCategory: ((d.expensesByCategory as { category: string; amount: number }[]) || []).map((r) => ({
        category: r.category,
        amount: num(r.amount),
      })),
      expensesByEntity: ((d.expensesByEntity as { entity: string; amount: number }[]) || []).map((r) => ({
        entity: r.entity,
        amount: num(r.amount),
      })),
    };
  }

  return fetchMonthlyPlFallback(filters);
}

async function fetchMonthlyPlFallback(filters: ReportFilterParams): Promise<MonthlyPlReport> {
  let tripQ = applyReportDateRange(
    supabase.from('trips').select('total_revenue'),
    filters.dateFrom,
    filters.dateTo,
  );
  if (filters.vehicle) tripQ = tripQ.eq('vehicle_number', filters.vehicle);

  let expQ = applyReportDateRange(
    supabase.from('expenses').select('amount, expense_type, category, paid_by'),
    filters.dateFrom,
    filters.dateTo,
  );
  if (filters.vehicle) expQ = expQ.eq('vehicle_number', filters.vehicle);
  if (filters.entity) expQ = expQ.eq('paid_by', filters.entity);

  const [{ data: trips }, { data: expenses }] = await Promise.all([tripQ, expQ]);

  const totalRevenue = (trips || []).reduce((s, t) => s + Number(t.total_revenue), 0);
  const byType = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byEntity = new Map<string, number>();
  let totalExpenses = 0;
  let jmTotal = 0;
  let maheshTotal = 0;

  for (const e of expenses || []) {
    const amt = Number(e.amount);
    totalExpenses += amt;
    if (e.paid_by === 'JM transport') jmTotal += amt;
    if (e.paid_by === 'Mahesh') maheshTotal += amt;
    byType.set(e.expense_type, (byType.get(e.expense_type) || 0) + amt);
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + amt);
    byEntity.set(e.paid_by, (byEntity.get(e.paid_by) || 0) + amt);
  }

  return {
    tripCount: (trips || []).length,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    jmTotal,
    maheshTotal,
    expensesByType: [...byType.entries()].map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount),
    expensesByCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    expensesByEntity: [...byEntity.entries()].map(([entity, amount]) => ({ entity, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export async function fetchVehiclePlReport(filters: ReportFilterParams): Promise<VehiclePlRow[]> {
  const { data, error } = await supabase.rpc('vehicle_pl_report', {
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_entity: filters.entity,
  });

  if (!error && data) {
    const rows = (data as { vehicles: VehiclePlRow[] }).vehicles || [];
    return rows.map((r) => ({
      vehicle: r.vehicle,
      tripCount: num(r.tripCount),
      totalWeight: num(r.totalWeight),
      revenue: num(r.revenue),
      vehicleExpenses: num(r.vehicleExpenses),
      netProfit: num(r.netProfit),
    }));
  }

  return fetchVehiclePlFallback(filters);
}

async function fetchVehiclePlFallback(filters: ReportFilterParams): Promise<VehiclePlRow[]> {
  const { data: trips } = await applyReportDateRange(
    supabase.from('trips').select('vehicle_number, weight_tons, total_revenue'),
    filters.dateFrom,
    filters.dateTo,
  );

  let expQ = applyReportDateRange(
    supabase
      .from('expenses')
      .select('vehicle_number, amount')
      .eq('expense_type', 'vehicle')
      .not('vehicle_number', 'is', null),
    filters.dateFrom,
    filters.dateTo,
  );
  if (filters.entity) expQ = expQ.eq('paid_by', filters.entity);

  const { data: expenses } = await expQ;

  const map = new Map<string, VehiclePlRow>();

  for (const t of trips || []) {
    const v = t.vehicle_number;
    const row = map.get(v) || { vehicle: v, tripCount: 0, totalWeight: 0, revenue: 0, vehicleExpenses: 0, netProfit: 0 };
    row.tripCount += 1;
    row.totalWeight += Number(t.weight_tons);
    row.revenue += Number(t.total_revenue);
    map.set(v, row);
  }

  for (const e of expenses || []) {
    const v = e.vehicle_number!;
    const row = map.get(v) || { vehicle: v, tripCount: 0, totalWeight: 0, revenue: 0, vehicleExpenses: 0, netProfit: 0 };
    row.vehicleExpenses += Number(e.amount);
    map.set(v, row);
  }

  return [...map.values()]
    .map((r) => ({ ...r, netProfit: r.revenue - r.vehicleExpenses }))
    .filter((r) => r.tripCount > 0 || r.vehicleExpenses > 0)
    .sort((a, b) => b.netProfit - a.netProfit);
}

export async function fetchDailyTripReport(filters: ReportFilterParams): Promise<DailyTripDay[]> {
  const { data, error } = await supabase.rpc('daily_trip_report', {
    p_date_from: filters.dateFrom,
    p_date_to: filters.dateTo,
    p_vehicle: filters.vehicle,
    p_entity: filters.entity,
  });

  if (!error && data) {
    const days = (data as { days: DailyTripDay[] }).days || [];
    return days.map((d) => ({
      date: d.date,
      tripCount: num(d.tripCount),
      totalWeight: num(d.totalWeight),
      revenue: num(d.revenue),
      vehicleExpenses: num(d.vehicleExpenses),
      netProfit: num(d.netProfit),
      trips: (d.trips || []).map((t) => ({
        ...t,
        weight_tons: num(t.weight_tons),
        rate_per_ton: num(t.rate_per_ton),
        total_revenue: num(t.total_revenue),
        advance_paid: num(t.advance_paid),
        balance_due: num(t.balance_due),
      })),
      expenses: (d.expenses || []).map((e) => ({
        ...e,
        amount: num(e.amount),
      })),
    }));
  }

  return fetchDailyTripFallback(filters);
}

async function fetchDailyTripFallback(filters: ReportFilterParams): Promise<DailyTripDay[]> {
  let tripQ = applyReportDateRange(
    supabase.from('trips').select('*').order('date').order('id'),
    filters.dateFrom,
    filters.dateTo,
  );
  if (filters.vehicle) tripQ = tripQ.eq('vehicle_number', filters.vehicle);

  let expQ = applyReportDateRange(
    supabase
      .from('expenses')
      .select('date, vehicle_number, category, amount, description')
      .eq('expense_type', 'vehicle')
      .order('date'),
    filters.dateFrom,
    filters.dateTo,
  );
  if (filters.vehicle) expQ = expQ.eq('vehicle_number', filters.vehicle);
  if (filters.entity) expQ = expQ.eq('paid_by', filters.entity);

  const [{ data: trips }, { data: expenses }] = await Promise.all([tripQ, expQ]);

  const dayMap = new Map<string, DailyTripDay>();

  function ensureDay(date: string): DailyTripDay {
    let day = dayMap.get(date);
    if (!day) {
      day = { date, tripCount: 0, totalWeight: 0, revenue: 0, vehicleExpenses: 0, netProfit: 0, trips: [], expenses: [] };
      dayMap.set(date, day);
    }
    return day;
  }

  for (const t of trips || []) {
    const day = ensureDay(t.date);
    day.tripCount += 1;
    day.totalWeight += Number(t.weight_tons);
    day.revenue += Number(t.total_revenue);
    day.trips.push({
      id: t.id,
      vehicle_number: t.vehicle_number,
      route_name: t.route_name,
      driver_name: t.driver_name,
      weight_tons: Number(t.weight_tons),
      rate_per_ton: Number(t.rate_per_ton),
      total_revenue: Number(t.total_revenue),
      advance_paid: Number(t.advance_paid),
      balance_due: Number(t.balance_due),
    });
  }

  for (const e of expenses || []) {
    const day = ensureDay(e.date);
    const amt = Number(e.amount);
    day.vehicleExpenses += amt;
    day.expenses.push({
      vehicle_number: e.vehicle_number,
      category: e.category,
      amount: amt,
      description: e.description,
    });
  }

  return [...dayMap.values()]
    .map((d) => ({ ...d, netProfit: d.revenue - d.vehicleExpenses }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
