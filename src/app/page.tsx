'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, JM_PARTNERS } from '@/lib/supabase';
import { formatCurrency, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import {
  type DashboardStats,
  fetchDashboardStats,
  getDashboardDateRange,
  mergeDailySeries,
} from '@/lib/dashboard-stats';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { ActiveFiltersBar } from '@/components/active-filters-bar';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { formatMultiFilterLabel } from '@/lib/filter-helpers';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

const emptyStats: DashboardStats = {
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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [showFilters, setShowFilters] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterPaidByEntities, setFilterPaidByEntities] = useState<string[]>([]);
  const [filterPaidByPersons, setFilterPaidByPersons] = useState<string[]>([]);
  const [filterPersons, setFilterPersons] = useState<string[]>([]);
  const [filterVehicles, setFilterVehicles] = useState<string[]>([]);
  const [filterPaymentSources, setFilterPaymentSources] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput);

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

      const { dateFrom, dateTo } = getDashboardDateRange(filterMonth, filterDateFrom, filterDateTo);
      const { data, error } = await fetchDashboardStats({
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
      });

      if (error) toast.error('Failed to load dashboard: ' + error);
      else setStats(data || emptyStats);

      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }

    loadStats();
  }, [filterMonth, filterDateFrom, filterDateTo, filterPaidByEntities, filterPaidByPersons, filterPersons, filterVehicles, filterPaymentSources, searchQuery]);

  const netProfit = stats.totalRevenue - stats.totalExpenses;
  const dailyRevenue = useMemo(
    () => mergeDailySeries(stats.dailyTrips, stats.dailyExpenses),
    [stats.dailyTrips, stats.dailyExpenses],
  );

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
            <p className="text-base sm:text-xl font-bold text-green-600 truncate">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">{stats.tripCount} trips</p>
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

        <Card className={stats.cashAvailable >= 0 ? 'border-green-300' : 'border-red-300'}>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Cash Available</p>
            <p className={`text-base sm:text-xl font-bold truncate ${stats.cashAvailable >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(stats.cashAvailable)}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-400">from revenue</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-sky-600 uppercase tracking-wide">JM Transport Expenses</p>
            <p className="text-2xl font-bold text-sky-700">{formatCurrency(stats.jmTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-orange-600 uppercase tracking-wide">Mahesh Expenses</p>
            <p className="text-2xl font-bold text-orange-700">{formatCurrency(stats.maheshTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-violet-600 uppercase tracking-wide">Capital Contributed</p>
            <p className="text-2xl font-bold text-violet-700">{formatCurrency(stats.totalCapitalIn)}</p>
          </CardContent>
        </Card>
      </div>

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
                    paddingAngle={2}
                  >
                    {stats.categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {stats.categoryBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-gray-700">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-medium text-gray-900">{formatCurrency(item.value)}</span>
                      {stats.totalExpenses > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({((item.value / stats.totalExpenses) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </div>
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
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.vehicleExpenses}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="vehicle" fontSize={12} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </div>
      )}
    </div>
  );
}
