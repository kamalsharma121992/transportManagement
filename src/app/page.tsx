'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase, JM_PARTNERS } from '@/lib/supabase';
import { formatCurrency, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { buildTextSearchFilter, EXPENSE_SEARCH_COLUMNS, TRIP_SEARCH_COLUMNS } from '@/lib/search';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Wallet,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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

export default function Dashboard() {
  const [trips, setTrips] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [capital, setCapital] = useState<any[]>([]);
  const [cashData, setCashData] = useState({ allRevenue: 0, allExpFromRevenue: 0, capPaidFromRevenue: 0 });
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters — default to current month
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
    setFilterMonth(currentMonth); setFilterDateFrom(''); setFilterDateTo('');
    setFilterPaidBy(''); setFilterPaidByPerson(''); setFilterPerson('');
    setFilterVehicle(''); setFilterPaymentSource('');
    setSearchInput('');
  }

  // Build active filter labels for display
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
      setVehicles((data || []).map((v: any) => v.vehicle_number));
    });
    supabase.from('partners').select('name').order('name').then(({ data }) => {
      setPartners((data || []).map((p: any) => p.name));
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (hasLoadedRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Build trip query
      let tripQuery = supabase.from('trips').select('*');
      if (filterVehicle) tripQuery = tripQuery.eq('vehicle_number', filterVehicle);
      if (filterMonth) {
        const [y, m] = filterMonth.split('-');
        tripQuery = tripQuery.gte('date', `${y}-${m}-01`).lte('date', new Date(Number(y), Number(m), 0).toISOString().split('T')[0]);
      } else {
        if (filterDateFrom) tripQuery = tripQuery.gte('date', filterDateFrom);
        if (filterDateTo) tripQuery = tripQuery.lte('date', filterDateTo);
      }
      const tripSearchFilter = buildTextSearchFilter([...TRIP_SEARCH_COLUMNS], searchQuery);
      if (tripSearchFilter) tripQuery = tripQuery.or(tripSearchFilter);

      // Build expense query
      let expQuery = supabase.from('expenses').select('*');
      if (filterPaidBy) expQuery = expQuery.eq('paid_by', filterPaidBy);
      if (filterPaidByPerson) expQuery = expQuery.eq('paid_by_person', filterPaidByPerson);
      if (filterPerson) expQuery = expQuery.eq('person', filterPerson);
      if (filterVehicle) expQuery = expQuery.eq('vehicle_number', filterVehicle);
      if (filterPaymentSource) expQuery = expQuery.eq('payment_source', filterPaymentSource);
      if (filterMonth) {
        const [y, m] = filterMonth.split('-');
        expQuery = expQuery.gte('date', `${y}-${m}-01`).lte('date', new Date(Number(y), Number(m), 0).toISOString().split('T')[0]);
      } else {
        if (filterDateFrom) expQuery = expQuery.gte('date', filterDateFrom);
        if (filterDateTo) expQuery = expQuery.lte('date', filterDateTo);
      }
      const expenseSearchFilter = buildTextSearchFilter([...EXPENSE_SEARCH_COLUMNS], searchQuery);
      if (expenseSearchFilter) expQuery = expQuery.or(expenseSearchFilter);

      const [{ data: t, error: tripError }, { data: e, error: expError }, { data: c }, { data: allT }, { data: allE }] = await Promise.all([
        tripQuery,
        expQuery,
        supabase.from('capital_contributions').select('*'),
        supabase.from('trips').select('total_revenue'),
        supabase.from('expenses').select('amount, payment_source'),
      ]);

      if (tripError) toast.error('Failed to load trips: ' + tripError.message);
      if (expError) toast.error('Failed to load expenses: ' + expError.message);

      setTrips(t || []);
      setExpenses(e || []);
      setCapital(c || []);
      // Cash available always from unfiltered data
      const allRevenue = (allT || []).reduce((s: number, r: any) => s + Number(r.total_revenue), 0);
      const allExpFromRevenue = (allE || []).filter((r: any) => r.payment_source === 'Revenue').reduce((s: number, r: any) => s + Number(r.amount), 0);
      const capPaidFromRevenue = (c || []).filter((r: any) => r.status === 'Paid' && r.payment_source === 'Revenue').reduce((s: number, r: any) => s + Number(r.value), 0);
      setCashData({ allRevenue, allExpFromRevenue, capPaidFromRevenue });
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }

    fetchData();
  }, [filterMonth, filterDateFrom, filterDateTo, filterPaidBy, filterPaidByPerson, filterPerson, filterVehicle, filterPaymentSource, searchQuery]);

  // Compute dashboard data from filtered results
  const totalRevenue = trips.reduce((sum, t) => sum + Number(t.total_revenue), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const jmTotal = expenses.filter(e => e.paid_by === 'JM transport').reduce((s, e) => s + Number(e.amount), 0);
  const maheshTotal = expenses.filter(e => e.paid_by === 'Mahesh').reduce((s, e) => s + Number(e.amount), 0);

  // Cash flow (always from ALL data, not filtered)
  const totalCapitalIn = capital.reduce((s, c) => s + Number(c.value), 0);
  const cashAvailable = cashData.allRevenue - cashData.allExpFromRevenue - cashData.capPaidFromRevenue;

  // Category breakdown
  const catMap: Record<string, number> = {};
  expenses.forEach((e) => {
    catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
  });
  const categoryBreakdown = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // Daily revenue vs expenses
  const dateMap: Record<string, { revenue: number; expenses: number }> = {};
  trips.forEach((t) => {
    const d = t.date;
    if (!dateMap[d]) dateMap[d] = { revenue: 0, expenses: 0 };
    dateMap[d].revenue += Number(t.total_revenue);
  });
  expenses.forEach((e) => {
    const d = e.date;
    if (!dateMap[d]) dateMap[d] = { revenue: 0, expenses: 0 };
    dateMap[d].expenses += Number(e.amount);
  });
  const dailyRevenue = Object.entries(dateMap)
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Vehicle-wise expenses
  const vehMap: Record<string, number> = {};
  expenses.filter((e) => e.expense_type === 'vehicle' && e.vehicle_number).forEach((e) => {
    vehMap[e.vehicle_number] = (vehMap[e.vehicle_number] || 0) + Number(e.amount);
  });
  const vehicleExpenses = Object.entries(vehMap)
    .map(([vehicle, amount]) => ({ vehicle, amount }))
    .sort((a, b) => b.amount - a.amount);

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
        filterLabels={activeFilterLabels}
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
            <p className="text-base sm:text-xl font-bold text-green-600 truncate">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">{trips.length} trips</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
            <p className="text-base sm:text-xl font-bold text-red-600 truncate">{formatCurrency(totalExpenses)}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">{expenses.length} records</p>
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

        <Card className={cashAvailable >= 0 ? 'border-green-300' : 'border-red-300'}>
          <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
            <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Cash Available</p>
            <p className={`text-base sm:text-xl font-bold truncate ${cashAvailable >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(cashAvailable)}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-400">from revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Entity split + Capital */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-sky-600 uppercase tracking-wide">JM Transport Expenses</p>
            <p className="text-2xl font-bold text-sky-700">{formatCurrency(jmTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-orange-600 uppercase tracking-wide">Mahesh Expenses</p>
            <p className="text-2xl font-bold text-orange-700">{formatCurrency(maheshTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-violet-600 uppercase tracking-wide">Capital Contributed</p>
            <p className="text-2xl font-bold text-violet-700">{formatCurrency(totalCapitalIn)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
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
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {categoryBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-gray-700">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-medium text-gray-900">{formatCurrency(item.value)}</span>
                      <span className="text-gray-400 text-xs ml-1">
                        ({((item.value / totalExpenses) * 100).toFixed(0)}%)
                      </span>
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
            <BarChart data={vehicleExpenses}>
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
