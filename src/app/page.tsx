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
  const [filterPaidBy, setFilterPaidBy] = useState('');
  const [filterPaidByPerson, setFilterPaidByPerson] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterPaymentSource, setFilterPaymentSource] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput);

  const hasActiveFilters = filterMonth !== currentMonth || !!filterDateFrom || !!filterDateTo || !!filterPaidBy || !!filterPaidByPerson || !!filterPerson || !!filterVehicle || !!filterPaymentSource || !!searchQuery;

  function clearFilters() {
    setFilterMonth(currentMonth);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterPaidBy('');
    setFilterPaidByPerson('');
    setFilterPerson('');
    setFilterVehicle('');
    setFilterPaymentSource('');
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
  if (filterPaidBy) activeFilterLabels.push('Entity: ' + filterPaidBy);
  if (filterPaidByPerson) activeFilterLabels.push('Paid by: ' + filterPaidByPerson);
  if (filterPerson) activeFilterLabels.push('Given to: ' + filterPerson);
  if (filterVehicle) activeFilterLabels.push('Vehicle: ' + filterVehicle);
  if (filterPaymentSource) activeFilterLabels.push('Source: ' + filterPaymentSource);
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
        tripVehicle: filterVehicle || null,
        tripSearch: searchQuery || null,
        expPaidBy: filterPaidBy || null,
        expPaidByPerson: filterPaidByPerson || null,
        expPerson: filterPerson || null,
        expVehicle: filterVehicle || null,
        expPaymentSource: filterPaymentSource || null,
        expSearch: searchQuery || null,
      });

      if (error) toast.error('Failed to load dashboard: ' + error);
      else setStats(data || emptyStats);

      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }

    loadStats();
  }, [filterMonth, filterDateFrom, filterDateTo, filterPaidBy, filterPaidByPerson, filterPerson, filterVehicle, filterPaymentSource, searchQuery]);

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
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Entity</label>
                  <select className={FILTER_SELECT_CLASS} value={filterPaidBy} onChange={(e) => setFilterPaidBy(e.target.value)}>
                    <option value="">All</option>
                    <option value="JM transport">JM Transport</option>
                    <option value="Mahesh">Mahesh</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Who Paid</label>
                  <select className={FILTER_SELECT_CLASS} value={filterPaidByPerson} onChange={(e) => setFilterPaidByPerson(e.target.value)}>
                    <option value="">All</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Given To</label>
                  <select className={FILTER_SELECT_CLASS} value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)}>
                    <option value="">All</option>
                    {partners.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Vehicle</label>
                  <select className={FILTER_SELECT_CLASS} value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                    <option value="">All</option>
                    {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Paid From</label>
                  <select className={FILTER_SELECT_CLASS} value={filterPaymentSource} onChange={(e) => setFilterPaymentSource(e.target.value)}>
                    <option value="">All</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Kamal">Kamal</option>
                    <option value="Bimal">Bimal</option>
                    <option value="Subham">Subham</option>
                    <option value="Mohit">Mohit</option>
                    <option value="Partner">Partner (unset)</option>
                  </select>
                </div>
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
