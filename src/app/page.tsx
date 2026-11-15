'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, JM_PARTNERS, DRIVER_PAY_CATEGORIES, SALARY_CATEGORIES } from '@/lib/supabase';
import { formatCurrency, formatDate, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import {
  type DashboardCategoryExpense,
  type DashboardStats,
  type DriverExpenseChart,
  type DriverExpenseChartRow,
  fetchDashboardCategoryExpenses,
  fetchDashboardDriverExpenseChart,
  fetchDashboardPersonExpenses,
  fetchDashboardStats,
  fetchDashboardVehicleExpenses,
  getDashboardDateRange,
  mergeDailySeries,
} from '@/lib/dashboard-stats';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { ActiveFiltersBar } from '@/components/active-filters-bar';
import { MonthlyStickyNotes } from '@/components/monthly-sticky-notes';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { formatMultiFilterLabel } from '@/lib/filter-helpers';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { readMonthParam, splitQueryList, useFilterQuery } from '@/hooks/use-filter-query';

const DRIVER_PAY_CATEGORY_SET = new Set<string>([
  DRIVER_PAY_CATEGORIES.advance,
  DRIVER_PAY_CATEGORIES.allowance,
  DRIVER_PAY_CATEGORIES.salary,
  ...SALARY_CATEGORIES,
]);

function driverCategoryAmount(row: DriverExpenseChartRow, category: string): number {
  if (category === DRIVER_PAY_CATEGORIES.advance) {
    return Number(row.payAdvance || 0) || Number(row['Advance'] || 0);
  }
  if (category === DRIVER_PAY_CATEGORIES.allowance) {
    return Number(row.payAllowance || 0) || Number(row['Daily Allowance'] || 0);
  }
  if (category === DRIVER_PAY_CATEGORIES.salary) {
    return (
      Number(row.paySalary || 0)
      || Number(row['Salary'] || 0) + Number(row['Driver Salary'] || 0)
    );
  }
  return Number(row[category] || 0);
}
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7',
];

function tripLogHref(
  payment: string[],
  opts: {
    month: string;
    currentMonth: string;
    from: string;
    dateTo: string;
    vehicles: string[];
  },
) {
  const params = new URLSearchParams();
  params.set('payment', payment.join(','));
  if (opts.month !== opts.currentMonth) params.set('month', opts.month);
  if (!opts.month) {
    if (opts.from) params.set('from', opts.from);
    if (opts.dateTo) params.set('dateTo', opts.dateTo);
  }
  if (opts.vehicles.length > 0) params.set('vehicles', opts.vehicles.join(','));
  return `/trips?${params.toString()}`;
}

type ExpenseHrefOpts = {
  month: string;
  currentMonth: string;
  from: string;
  dateTo: string;
  vehicles: string[];
  entities: string[];
  paidBy: string[];
  persons: string[];
  sources: string[];
  q: string;
};

function applyExpenseHrefOpts(params: URLSearchParams, opts: ExpenseHrefOpts) {
  if (opts.month) {
    if (opts.month !== opts.currentMonth) params.set('month', opts.month);
  } else {
    params.set('month', '');
    if (opts.from) params.set('from', opts.from);
    if (opts.dateTo) params.set('dateTo', opts.dateTo);
  }
  if (opts.vehicles.length > 0) params.set('vehicles', opts.vehicles.join(','));
  if (opts.entities.length > 0) params.set('entities', opts.entities.join(','));
  if (opts.paidBy.length > 0) params.set('paidBy', opts.paidBy.join(','));
  if (opts.persons.length > 0) params.set('persons', opts.persons.join(','));
  if (opts.sources.length > 0) params.set('sources', opts.sources.join(','));
  if (opts.q) params.set('q', opts.q);
}

function expensesCategoryHref(category: string, opts: ExpenseHrefOpts) {
  const params = new URLSearchParams();
  params.set('categories', category);
  applyExpenseHrefOpts(params, opts);
  return `/expenses?${params.toString()}`;
}

function expensesVehicleHref(vehicle: string, opts: ExpenseHrefOpts) {
  const params = new URLSearchParams();
  params.set('vehicles', vehicle);
  params.set('type', 'vehicle');
  applyExpenseHrefOpts(params, { ...opts, vehicles: [vehicle] });
  return `/expenses?${params.toString()}`;
}

function expensesPersonHref(person: string, opts: ExpenseHrefOpts) {
  const params = new URLSearchParams();
  params.set('persons', person);
  applyExpenseHrefOpts(params, { ...opts, persons: [person] });
  return `/expenses?${params.toString()}`;
}

const emptyStats: DashboardStats = {
  tripCount: 0,
  totalRevenue: 0,
  pendingRevenue: 0,
  collectedRevenue: 0,
  writtenOffRevenue: 0,
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

export default function Dashboard() {
  const searchParams = useSearchParams();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [expenseSheet, setExpenseSheet] = useState<{ kind: 'category' | 'vehicle' | 'person'; key: string } | null>(null);
  const [driverChart, setDriverChart] = useState<DriverExpenseChart>({ categories: [], rows: [] });
  const [hiddenDriverCategories, setHiddenDriverCategories] = useState<Set<string>>(() => new Set());
  /** Categories shown as table columns. Empty = default pay columns. */
  const [driverTableCategories, setDriverTableCategories] = useState<string[]>([]);
  const [driverTableDriverQuery, setDriverTableDriverQuery] = useState('');
  const [driverTablePreset, setDriverTablePreset] = useState<'pay' | 'tasks' | 'all' | 'custom'>('pay');
  const [expandedDriverRows, setExpandedDriverRows] = useState<Set<string>>(() => new Set());
  const [sheetExpenses, setSheetExpenses] = useState<DashboardCategoryExpense[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(() => Boolean(
    searchParams.get('from') || searchParams.get('dateTo') || searchParams.get('entities')
    || searchParams.get('paidBy') || searchParams.get('persons') || searchParams.get('vehicles')
    || searchParams.get('sources') || searchParams.get('q')
    || (searchParams.has('month') && searchParams.get('month') !== currentMonth),
  ));

  const [filterMonth, setFilterMonth] = useState(() => readMonthParam(searchParams, currentMonth));
  const [filterDateFrom, setFilterDateFrom] = useState(() => searchParams.get('from') || '');
  const [filterDateTo, setFilterDateTo] = useState(() => searchParams.get('dateTo') || '');
  const [filterPaidByEntities, setFilterPaidByEntities] = useState<string[]>(() => splitQueryList(searchParams.get('entities')));
  const [filterPaidByPersons, setFilterPaidByPersons] = useState<string[]>(() => splitQueryList(searchParams.get('paidBy')));
  const [filterPersons, setFilterPersons] = useState<string[]>(() => splitQueryList(searchParams.get('persons')));
  const [filterVehicles, setFilterVehicles] = useState<string[]>(() => splitQueryList(searchParams.get('vehicles')));
  const [filterPaymentSources, setFilterPaymentSources] = useState<string[]>(() => splitQueryList(searchParams.get('sources')));
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') || '');
  const searchQuery = useDebouncedValue(searchInput);

  useFilterQuery([
    { key: 'month', value: filterMonth, defaultValue: currentMonth },
    { key: 'from', value: filterDateFrom },
    { key: 'dateTo', value: filterDateTo },
    { key: 'entities', value: filterPaidByEntities },
    { key: 'paidBy', value: filterPaidByPersons },
    { key: 'persons', value: filterPersons },
    { key: 'vehicles', value: filterVehicles },
    { key: 'sources', value: filterPaymentSources },
    { key: 'q', value: searchQuery },
  ]);

  const DASHBOARD_PAYMENT_SOURCES = ['Revenue', 'Kamal', 'Bimal', 'Subham', 'Mohit', 'Partner'];

  const hasActiveFilters = filterMonth !== currentMonth || !!filterDateFrom || !!filterDateTo || filterPaidByEntities.length > 0 || filterPaidByPersons.length > 0 || filterPersons.length > 0 || filterVehicles.length > 0 || filterPaymentSources.length > 0 || !!searchQuery;

  function clearFilters() {
    setFilterMonth(currentMonth);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterPaidByEntities([]);
    setFilterPaidByPersons([]);
    setFilterPersons([]);
    setFilterVehicles([]);
    setFilterPaymentSources([]);
    setSearchInput('');
  }

  const activeFilterLabels: string[] = [];
  if (filterMonth) {
    const d = new Date(filterMonth + '-01');
    activeFilterLabels.push(d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
  } else if (!filterDateFrom && !filterDateTo) {
    activeFilterLabels.push('All months');
  }
  if (filterDateFrom) activeFilterLabels.push('From: ' + filterDateFrom);
  if (filterDateTo) activeFilterLabels.push('To: ' + filterDateTo);
  if (filterPaidByEntities.length > 0) {
    const label = formatMultiFilterLabel('Entity', filterPaidByEntities);
    if (label) activeFilterLabels.push(label);
  }
  if (filterPaidByPersons.length > 0) {
    const label = formatMultiFilterLabel('Paid by', filterPaidByPersons);
    if (label) activeFilterLabels.push(label);
  }
  if (filterPersons.length > 0) {
    const label = formatMultiFilterLabel('Given to', filterPersons);
    if (label) activeFilterLabels.push(label);
  }
  if (filterVehicles.length > 0) {
    const label = formatMultiFilterLabel('Vehicle', filterVehicles);
    if (label) activeFilterLabels.push(label);
  }
  if (filterPaymentSources.length > 0) {
    const label = formatMultiFilterLabel('Source', filterPaymentSources);
    if (label) activeFilterLabels.push(label);
  }
  if (searchQuery) activeFilterLabels.push('Search: ' + searchQuery);

  useEffect(() => {
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: { vehicle_number: string }) => v.vehicle_number));
    });
    supabase.from('partners').select('name').order('name').then(({ data }) => {
      setPartners((data || []).map((p: { name: string }) => p.name));
    });
  }, []);

  useEffect(() => {
    async function loadStats() {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const { dateFrom, dateTo } = getDashboardDateRange(filterMonth, filterDateFrom, filterDateTo);
        const filters = {
          dateFrom,
          dateTo,
          tripVehicles: filterVehicles,
          tripSearch: searchQuery || null,
          expPaidBy: filterPaidByEntities,
          expPaidByPerson: filterPaidByPersons,
          expPerson: filterPersons,
          expVehicles: filterVehicles,
          expPaymentSources: filterPaymentSources,
          expSearch: searchQuery || null,
        };
        const [{ data, error }, driverResult] = await Promise.all([
          fetchDashboardStats(filters),
          fetchDashboardDriverExpenseChart(filters),
        ]);

        if (error) toast.error('Failed to load dashboard: ' + error);
        else setStats({ ...emptyStats, ...(data || {}) });

        if (driverResult.error) toast.error('Failed to load driver expenses: ' + driverResult.error);
        else {
          setDriverChart(driverResult.data);
          setHiddenDriverCategories(new Set());
        }
      } catch (err) {
        toast.error('Failed to load dashboard: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        hasLoadedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    }

    loadStats();
  }, [filterMonth, filterDateFrom, filterDateTo, filterPaidByEntities, filterPaidByPersons, filterPersons, filterVehicles, filterPaymentSources, searchQuery]);

  const netProfit = stats.totalRevenue - stats.totalExpenses;
  const dailyRevenue = useMemo(
    () => mergeDailySeries(stats.dailyTrips, stats.dailyExpenses),
    [stats.dailyTrips, stats.dailyExpenses],
  );

  const dashboardFilters = useMemo(() => {
    const { dateFrom, dateTo } = getDashboardDateRange(filterMonth, filterDateFrom, filterDateTo);
    return {
      dateFrom,
      dateTo,
      tripVehicles: filterVehicles,
      tripSearch: searchQuery || null,
      expPaidBy: filterPaidByEntities,
      expPaidByPerson: filterPaidByPersons,
      expPerson: filterPersons,
      expVehicles: filterVehicles,
      expPaymentSources: filterPaymentSources,
      expSearch: searchQuery || null,
    };
  }, [
    filterMonth, filterDateFrom, filterDateTo, filterVehicles,
    filterPaidByEntities, filterPaidByPersons, filterPersons, filterPaymentSources, searchQuery,
  ]);

  async function openExpenseDrilldown(kind: 'category' | 'vehicle' | 'person', key: string) {
    if (!key) return;
    setExpenseSheet({ kind, key });
    setSheetLoading(true);
    setSheetExpenses([]);
    const { data, error } = kind === 'category'
      ? await fetchDashboardCategoryExpenses(dashboardFilters, key)
      : kind === 'vehicle'
        ? await fetchDashboardVehicleExpenses(dashboardFilters, key)
        : await fetchDashboardPersonExpenses(dashboardFilters, key);
    setSheetLoading(false);
    if (error) {
      toast.error('Failed to load expenses: ' + error);
      return;
    }
    setSheetExpenses(data);
  }

  function toggleDriverCategory(category: string) {
    setHiddenDriverCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      // Keep at least one category visible
      if (next.size >= driverChart.categories.length) return prev;
      return next;
    });
  }

  const sheetHrefOpts: ExpenseHrefOpts = {
    month: filterMonth,
    currentMonth,
    from: filterDateFrom,
    dateTo: filterDateTo,
    vehicles: filterVehicles,
    entities: filterPaidByEntities,
    paidBy: filterPaidByPersons,
    persons: filterPersons,
    sources: filterPaymentSources,
    q: searchQuery,
  };
  const sheetTotal = sheetExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const sheetExpensesHref = expenseSheet
    ? expenseSheet.kind === 'category'
      ? expensesCategoryHref(expenseSheet.key, sheetHrefOpts)
      : expenseSheet.kind === 'vehicle'
        ? expensesVehicleHref(expenseSheet.key, sheetHrefOpts)
        : expensesPersonHref(expenseSheet.key, sheetHrefOpts)
    : '/expenses';

  const visibleDriverCategories = driverChart.categories.filter((c) => !hiddenDriverCategories.has(c));

  const driverPayCategories = useMemo(
    () => driverChart.categories.filter((c) => DRIVER_PAY_CATEGORY_SET.has(c)),
    [driverChart.categories],
  );
  const driverTaskCategories = useMemo(
    () => driverChart.categories.filter((c) => !DRIVER_PAY_CATEGORY_SET.has(c)),
    [driverChart.categories],
  );

  const activeTableCategories = useMemo(() => {
    if (driverTablePreset === 'pay') {
      return driverPayCategories.length > 0
        ? driverPayCategories
        : [DRIVER_PAY_CATEGORIES.advance, DRIVER_PAY_CATEGORIES.allowance, DRIVER_PAY_CATEGORIES.salary];
    }
    if (driverTablePreset === 'tasks') return driverTaskCategories;
    if (driverTablePreset === 'all') return driverChart.categories;
    const custom = driverTableCategories.filter((c) => driverChart.categories.includes(c));
    return custom.length > 0 ? custom : driverPayCategories;
  }, [
    driverTablePreset,
    driverTableCategories,
    driverPayCategories,
    driverTaskCategories,
    driverChart.categories,
  ]);

  const driverTableRows = useMemo(() => {
    const q = driverTableDriverQuery.trim().toLowerCase();
    return driverChart.rows
      .map((row) => {
        const amounts: Record<string, number> = {};
        let selectedTotal = 0;
        for (const category of activeTableCategories) {
          const amount = driverCategoryAmount(row, category);
          amounts[category] = amount;
          selectedTotal += amount;
        }
        return { row, amounts, selectedTotal };
      })
      .filter(({ row, selectedTotal }) => {
        if (selectedTotal <= 0) return false;
        if (!q) return true;
        return String(row.driver).toLowerCase().includes(q);
      })
      .sort((a, b) => b.selectedTotal - a.selectedTotal);
  }, [driverChart.rows, activeTableCategories, driverTableDriverQuery]);

  const driverTableColTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    let total = 0;
    for (const category of activeTableCategories) totals[category] = 0;
    for (const { amounts, selectedTotal } of driverTableRows) {
      total += selectedTotal;
      for (const category of activeTableCategories) {
        totals[category] = (totals[category] || 0) + (amounts[category] || 0);
      }
    }
    return { totals, total };
  }, [driverTableRows, activeTableCategories]);

  const driverPayTotals = useMemo(() => {
    return driverChart.rows.reduce(
      (acc, r) => ({
        advance: acc.advance + driverCategoryAmount(r, DRIVER_PAY_CATEGORIES.advance),
        allowance: acc.allowance + driverCategoryAmount(r, DRIVER_PAY_CATEGORIES.allowance),
        salary: acc.salary + driverCategoryAmount(r, DRIVER_PAY_CATEGORIES.salary),
        tasks: acc.tasks + driverTaskCategories.reduce((s, c) => s + driverCategoryAmount(r, c), 0),
        total: acc.total + Number(r.total),
      }),
      { advance: 0, allowance: 0, salary: 0, tasks: 0, total: 0 },
    );
  }, [driverChart.rows, driverTaskCategories]);

  function applyDriverTablePreset(preset: 'pay' | 'tasks' | 'all') {
    setDriverTablePreset(preset);
    if (preset === 'pay') setDriverTableCategories(driverPayCategories);
    else if (preset === 'tasks') setDriverTableCategories(driverTaskCategories);
    else setDriverTableCategories(driverChart.categories);
  }

  function toggleDriverRow(driver: string) {
    setExpandedDriverRows((prev) => {
      const next = new Set(prev);
      if (next.has(driver)) next.delete(driver);
      else next.add(driver);
      return next;
    });
  }

  // Copy rows so Recharts stacked bars cannot mutate chart state in place.
  const driverChartData = driverChart.rows.map((row) => ({ ...row }));

  const periodLabel = filterMonth
    ? new Date(`${filterMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : filterDateFrom || filterDateTo
      ? [filterDateFrom && `From ${filterDateFrom}`, filterDateTo && `To ${filterDateTo}`].filter(Boolean).join(' · ')
      : 'All months';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: 'Search vehicle, driver, category, description...',
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        clearFiltersLabel="Reset filters"
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
      <div className={`space-y-6 transition-opacity ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="space-y-2">
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium">
          {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Advanced Filters
          {hasActiveFilters && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">Active</span>}
        </button>

        {showFilters && (
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Month</label>
                  <select
                    className={FILTER_SELECT_CLASS}
                    value={filterMonth}
                    onChange={(e) => { setFilterMonth(e.target.value); setFilterDateFrom(''); setFilterDateTo(''); }}
                  >
                    {getMonthFilterOptions().map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Date From</label>
                  <Input className="min-w-0" type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); setFilterMonth(''); }} />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Date To</label>
                  <Input className="min-w-0" type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); setFilterMonth(''); }} />
                </div>
                <MultiSelectFilter
                  label="Entity"
                  options={['JM transport', 'Mahesh']}
                  selected={filterPaidByEntities}
                  onChange={setFilterPaidByEntities}
                  placeholder="All"
                  searchPlaceholder="Search entity..."
                />
                <MultiSelectFilter
                  label="Who Paid"
                  options={JM_PARTNERS}
                  selected={filterPaidByPersons}
                  onChange={setFilterPaidByPersons}
                  placeholder="All"
                  searchPlaceholder="Search person..."
                />
                <MultiSelectFilter
                  label="Given To"
                  options={partners}
                  selected={filterPersons}
                  onChange={setFilterPersons}
                  placeholder="All"
                  searchPlaceholder="Search partner..."
                />
                <MultiSelectFilter
                  label="Vehicle"
                  options={vehicles}
                  selected={filterVehicles}
                  onChange={setFilterVehicles}
                  placeholder="All"
                  searchPlaceholder="Search vehicle..."
                />
                <MultiSelectFilter
                  label="Paid From"
                  options={DASHBOARD_PAYMENT_SOURCES}
                  selected={filterPaymentSources}
                  onChange={setFilterPaymentSources}
                  placeholder="All"
                  searchPlaceholder="Search source..."
                />
              </div>
            </CardContent>
          </Card>
        )}
        <ActiveFiltersBar
          labels={activeFilterLabels}
          onClear={hasActiveFilters ? clearFilters : undefined}
          clearLabel="Reset filters"
        />
      </div>

      <MonthlyStickyNotes month={filterMonth || currentMonth} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
            <p className="text-base sm:text-xl font-bold text-green-600 truncate">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">{stats.tripCount} trips · excluding will not pay</p>
          </CardContent>
        </Card>

        <Link
          href={tripLogHref(['Fully Paid', 'Partial Pending', 'Will not pay'], {
            month: filterMonth,
            currentMonth,
            from: filterDateFrom,
            dateTo: filterDateTo,
            vehicles: filterVehicles,
          })}
          className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
        >
          <Card className="h-full transition-colors hover:bg-green-50/80">
            <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Amount Collected</p>
              <p className="text-base sm:text-xl font-bold text-green-700 truncate">{formatCurrency(stats.collectedRevenue)}</p>
              <p className="text-[10px] sm:text-xs text-gray-400">view trips</p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={tripLogHref(['Pending', 'Partial Pending'], {
            month: filterMonth,
            currentMonth,
            from: filterDateFrom,
            dateTo: filterDateTo,
            vehicles: filterVehicles,
          })}
          className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Card className="h-full transition-colors hover:bg-amber-50/80">
            <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
              <p className="text-[10px] sm:text-xs text-amber-600 uppercase tracking-wide">Pending Payment</p>
              <p className="text-base sm:text-xl font-bold text-amber-700 truncate">{formatCurrency(stats.pendingRevenue)}</p>
              <p className="text-[10px] sm:text-xs text-gray-400">view trips</p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={tripLogHref(['Will not pay'], {
            month: filterMonth,
            currentMonth,
            from: filterDateFrom,
            dateTo: filterDateTo,
            vehicles: filterVehicles,
          })}
          className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          <Card className="h-full transition-colors hover:bg-gray-50">
            <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
              <p className="text-[10px] sm:text-xs text-gray-600 uppercase tracking-wide">Will not pay</p>
              <p className="text-base sm:text-xl font-bold text-gray-700 truncate">{formatCurrency(stats.writtenOffRevenue)}</p>
              <p className="text-[10px] sm:text-xs text-gray-400">view trips</p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
            <p className="text-base sm:text-xl font-bold text-red-600 truncate">{formatCurrency(stats.totalExpenses)}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">{stats.expenseCount} records</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Net Profit</p>
            <p className={`text-base sm:text-xl font-bold truncate ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netProfit)}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-400">revenue − expenses</p>
          </CardContent>
        </Card>

        <Card className={stats.cashAvailable >= 0 ? 'border-green-300' : 'border-red-300'}>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Cash Available</p>
            <p className={`text-base sm:text-xl font-bold truncate ${stats.cashAvailable >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(stats.cashAvailable)}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-400">after expenses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-xs text-violet-600 uppercase tracking-wide">Capital Contributed</p>
          <p className="text-2xl font-bold text-violet-700">{formatCurrency(stats.totalCapitalIn)}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  fontSize={12}
                />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-IN')}
                />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-gray-500">Click a category to see matching expenses</p>
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      const row = data as { name?: string; payload?: { name?: string } };
                      const name = row?.name || row?.payload?.name;
                      if (name) void openExpenseDrilldown('category', name);
                    }}
                  >
                    {stats.categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} className="cursor-pointer outline-none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {stats.categoryBreakdown.map((item, i) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => void openExpenseDrilldown('category', item.name)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm',
                      'hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      expenseSheet?.kind === 'category' && expenseSheet.key === item.name && 'bg-blue-50',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-gray-700">{item.name}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-medium text-gray-900">{formatCurrency(item.value)}</span>
                      {stats.totalExpenses > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({((item.value / stats.totalExpenses) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vehicle-wise Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-gray-500">Click a bar to see expenses for that vehicle</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.vehicleExpenses}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="vehicle" fontSize={12} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar
                dataKey="amount"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(data) => {
                  const row = data as { vehicle?: string; payload?: { vehicle?: string } };
                  const vehicle = row?.vehicle || row?.payload?.vehicle;
                  if (vehicle) void openExpenseDrilldown('vehicle', vehicle);
                }}
              >
                {stats.vehicleExpenses.map((item) => (
                  <Cell
                    key={item.vehicle}
                    fill={expenseSheet?.kind === 'vehicle' && expenseSheet.key === item.vehicle ? '#1d4ed8' : '#3b82f6'}
                    className="cursor-pointer outline-none"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Driver-wise Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-gray-500">
            Stacked by category · click legend to show/hide · click a bar for that driver&apos;s expenses
          </p>
          {driverChart.rows.length === 0 ? (
            <p className="py-8 text-sm text-gray-500">
              No expenses given to drivers for {periodLabel}. Try another month or clear filters.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <span>
                  {driverChart.rows.length} driver{driverChart.rows.length === 1 ? '' : 's'}
                </span>
                <span>
                  Advance{' '}
                  <span className="font-medium text-gray-900">{formatCurrency(driverPayTotals.advance)}</span>
                </span>
                <span>
                  Daily allowance{' '}
                  <span className="font-medium text-gray-900">{formatCurrency(driverPayTotals.allowance)}</span>
                </span>
                <span>
                  Salary{' '}
                  <span className="font-medium text-gray-900">{formatCurrency(driverPayTotals.salary)}</span>
                </span>
                {driverPayTotals.tasks > 0 && (
                  <span>
                    Tasks / other{' '}
                    <span className="font-medium text-gray-900">{formatCurrency(driverPayTotals.tasks)}</span>
                  </span>
                )}
                <span>
                  Total{' '}
                  <span className="font-medium text-gray-900">{formatCurrency(driverPayTotals.total)}</span>
                </span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={driverChartData} margin={{ left: 4, right: 8, top: 8, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="driver"
                    fontSize={11}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
                  <Tooltip
                    formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Legend
                    wrapperStyle={{ cursor: 'pointer' }}
                    onClick={(entry) => {
                      const key = String(entry.dataKey || entry.value || '');
                      if (key) toggleDriverCategory(key);
                    }}
                    formatter={(value) => (
                      <span
                        className={cn(
                          'text-xs',
                          hiddenDriverCategories.has(String(value)) && 'text-gray-400 line-through',
                        )}
                      >
                        {value}
                      </span>
                    )}
                  />
                  {visibleDriverCategories.map((category, index) => {
                    const colorIndex = driverChart.categories.indexOf(category);
                    const isLast = index === visibleDriverCategories.length - 1;
                    return (
                      <Bar
                        key={category}
                        dataKey={category}
                        name={category}
                        stackId="driver-expenses"
                        fill={COLORS[(colorIndex >= 0 ? colorIndex : index) % COLORS.length]}
                        radius={isLast ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        cursor="pointer"
                        onClick={(data) => {
                          const row = data as { driver?: string; payload?: { driver?: string } };
                          const driver = row?.payload?.driver || row?.driver;
                          if (driver) void openExpenseDrilldown('person', driver);
                        }}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-2">
                {driverChart.categories.map((category, i) => {
                  const hidden = hiddenDriverCategories.has(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleDriverCategory(category)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                        hidden
                          ? 'border-gray-200 bg-gray-50 text-gray-400 line-through'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                      )}
                      title={hidden ? `Show ${category}` : `Hide ${category}`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: hidden ? '#d1d5db' : COLORS[i % COLORS.length] }}
                      />
                      {category}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: 'pay', label: 'Pay' },
                      { key: 'tasks', label: 'Tasks / other' },
                      { key: 'all', label: 'All given' },
                    ] as const).map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => applyDriverTablePreset(preset.key)}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs transition-colors',
                          driverTablePreset === preset.key
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        {preset.label}
                        {preset.key === 'tasks' && driverTaskCategories.length > 0 && (
                          <span className="ml-1 text-gray-400">({driverTaskCategories.length})</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="min-w-[160px] flex-1 sm:max-w-[220px]">
                    <MultiSelectFilter
                      label="Table columns"
                      options={driverChart.categories}
                      selected={activeTableCategories}
                      onChange={(selected) => {
                        setDriverTablePreset('custom');
                        setDriverTableCategories(selected);
                      }}
                      placeholder="Categories"
                    />
                  </div>
                  <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      Driver
                    </label>
                    <Input
                      value={driverTableDriverQuery}
                      onChange={(e) => setDriverTableDriverQuery(e.target.value)}
                      placeholder="Filter driver..."
                      className="h-9"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">
                  Use <span className="font-medium text-gray-700">Tasks / other</span> to see Maintenance,
                  Supplies, Meals, and other cash given to drivers for work — not salary or allowance.
                </p>
                {activeTableCategories.length === 0 ? (
                  <p className="py-4 text-sm text-gray-500">
                    {driverTablePreset === 'tasks'
                      ? 'No task / other expenses given to drivers in this period.'
                      : 'Select at least one category to show in the table.'}
                  </p>
                ) : driverTableRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No drivers match these filters.</p>
                ) : (
                  <>
                    {/* Mobile: expandable rows */}
                    <div className="space-y-2 md:hidden">
                      {driverTableRows.map(({ row, amounts, selectedTotal }) => {
                        const driver = String(row.driver);
                        const open = expandedDriverRows.has(driver);
                        const share =
                          driverTableColTotals.total > 0
                            ? (selectedTotal / driverTableColTotals.total) * 100
                            : 0;
                        return (
                          <div
                            key={driver}
                            className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                              onClick={() => toggleDriverRow(driver)}
                              aria-expanded={open}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-blue-700">{driver}</p>
                                <div className="mt-1.5 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${Math.min(100, Math.max(4, share))}%` }}
                                  />
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold tabular-nums text-gray-900">
                                  {formatCurrency(selectedTotal)}
                                </p>
                                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-gray-500">
                                  {share.toFixed(0)}%
                                  {open ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </p>
                              </div>
                            </button>
                            {open && (
                              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                  {activeTableCategories.map((category) => (
                                    <div key={category}>
                                      <p className="text-[10px] uppercase tracking-wide text-gray-500">
                                        {category}
                                      </p>
                                      <p className="text-sm font-medium tabular-nums text-gray-900">
                                        {formatCurrency(amounts[category] || 0)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs"
                                    onClick={() => void openExpenseDrilldown('person', driver)}
                                  >
                                    View expenses
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs">
                        <div className="flex items-center justify-between font-medium text-gray-900">
                          <span>All drivers</span>
                          <span className="tabular-nums">{formatCurrency(driverTableColTotals.total)}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-gray-600">
                          {activeTableCategories.map((category) => (
                            <div key={category} className="flex justify-between gap-2">
                              <span className="truncate">{category}</span>
                              <span className="shrink-0 tabular-nums">
                                {formatCurrency(driverTableColTotals.totals[category] || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Desktop: full table */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead>
                          <tr className="border-b text-gray-500">
                            <th className="py-1.5 pr-2 font-medium">Driver</th>
                            {activeTableCategories.map((category) => (
                              <th
                                key={category}
                                className="whitespace-nowrap py-1.5 pr-2 text-right font-medium"
                              >
                                {category}
                              </th>
                            ))}
                            <th className="py-1.5 pr-2 text-right font-medium">Total</th>
                            <th className="py-1.5 text-right font-medium">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driverTableRows.map(({ row, amounts, selectedTotal }) => {
                            const share =
                              driverTableColTotals.total > 0
                                ? (selectedTotal / driverTableColTotals.total) * 100
                                : 0;
                            return (
                              <tr key={row.driver} className="border-b border-gray-100">
                                <td className="py-1.5 pr-2">
                                  <button
                                    type="button"
                                    className="font-medium text-blue-700 hover:underline"
                                    onClick={() => void openExpenseDrilldown('person', String(row.driver))}
                                  >
                                    {row.driver}
                                  </button>
                                </td>
                                {activeTableCategories.map((category) => (
                                  <td
                                    key={category}
                                    className="py-1.5 pr-2 text-right tabular-nums text-gray-700"
                                  >
                                    {formatCurrency(amounts[category] || 0)}
                                  </td>
                                ))}
                                <td className="py-1.5 pr-2 text-right tabular-nums font-medium text-gray-900">
                                  {formatCurrency(selectedTotal)}
                                </td>
                                <td className="py-1.5 text-right text-gray-500">{share.toFixed(0)}%</td>
                              </tr>
                            );
                          })}
                          <tr className="border-t border-gray-200 bg-gray-50 font-medium text-gray-900">
                            <td className="py-2 pr-2">All drivers</td>
                            {activeTableCategories.map((category) => (
                              <td key={category} className="py-2 pr-2 text-right tabular-nums">
                                {formatCurrency(driverTableColTotals.totals[category] || 0)}
                              </td>
                            ))}
                            <td className="py-2 pr-2 text-right tabular-nums">
                              {formatCurrency(driverTableColTotals.total)}
                            </td>
                            <td className="py-2 text-right text-gray-500">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
      )}

      <Dialog open={expenseSheet != null} onOpenChange={(open) => { if (!open) setExpenseSheet(null); }}>
        <DialogContent
          className={cn(
            'fixed inset-y-0 right-0 left-auto top-0 z-50 flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l p-0 sm:max-w-md sm:rounded-l-xl',
            'data-open:zoom-in-100 data-closed:zoom-out-100 data-open:slide-in-from-right data-closed:slide-out-to-right',
          )}
        >
          {expenseSheet && (
            <>
              <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 sm:px-5">
                <DialogTitle className="truncate">
                  {expenseSheet.kind === 'vehicle'
                    ? `Vehicle ${expenseSheet.key}`
                    : expenseSheet.kind === 'person'
                      ? `Driver ${expenseSheet.key}`
                      : expenseSheet.key}
                </DialogTitle>
                <p className="text-sm text-gray-500">
                  {periodLabel}
                  {!sheetLoading && (
                    <>
                      {' · '}
                      {sheetExpenses.length} expense{sheetExpenses.length === 1 ? '' : 's'}
                      {' · '}
                      <span className="font-medium text-red-600">{formatCurrency(sheetTotal)}</span>
                    </>
                  )}
                </p>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {sheetLoading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading expenses...
                  </div>
                ) : sheetExpenses.length === 0 ? (
                  <p className="py-8 text-sm text-gray-500">
                    {expenseSheet.kind === 'vehicle'
                      ? 'No vehicle expenses for this vehicle under the current filters.'
                      : expenseSheet.kind === 'person'
                        ? 'No expenses for this driver under the current filters.'
                        : 'No expenses in this category for the current filters.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {sheetExpenses.map((exp) => (
                      <li key={exp.id} className="rounded-lg border bg-white px-3 py-2.5 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">{formatDate(exp.date)}</p>
                            <p className="mt-0.5 font-medium text-gray-900">
                              {exp.description?.trim() || exp.category}
                            </p>
                            <p className="mt-1 truncate text-xs text-gray-500">
                              {[
                                expenseSheet.kind === 'person' ? exp.category : expenseSheet.kind === 'category' ? exp.vehicle_number : exp.category,
                                expenseSheet.kind !== 'person' && exp.person && `Given to ${exp.person}`,
                                exp.paid_by_person && `Paid by ${exp.paid_by_person}`,
                                exp.payment_source,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <p className="shrink-0 font-semibold text-red-600">{formatCurrency(Number(exp.amount))}</p>
                        </div>
                      </li>
                    ))}
                    {sheetExpenses.length >= 100 && (
                      <p className="pt-1 text-xs text-gray-500">Showing first 100. Open Expenses for the full list.</p>
                    )}
                  </ul>
                )}
              </div>

              <div className="flex shrink-0 gap-2 border-t bg-white px-4 py-3 sm:px-5">
                <Link href={sheetExpensesHref} className={cn(buttonVariants(), 'flex-1')}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in Expenses
                </Link>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setExpenseSheet(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


