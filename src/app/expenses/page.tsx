'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, Expense, ExpenseType, EXPENSE_TYPES, JM_PARTNERS, PAYMENT_SOURCES } from '@/lib/supabase';
import {
  buildAllCategoryNames,
  buildCategoriesByType,
  DEFAULT_CATEGORIES_BY_TYPE,
  fetchExpenseCategories,
} from '@/lib/expense-categories';
import { formatCurrency, formatDate, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/pagination-controls';
import { PageHeader } from '@/components/page-header';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';
import { buildTextSearchFilter, EXPENSE_SEARCH_COLUMNS } from '@/lib/search';
import { applySupabaseSort } from '@/lib/sort';
import { useTableSort } from '@/hooks/use-table-sort';
import { SortableTableHead } from '@/components/sortable-table-head';

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  expense_type: 'vehicle' as ExpenseType,
  vehicle_number: '',
  category: '',
  amount: 0,
  description: '',
  person: '',
  paid_by_person: '',
  bill_receipt_ref: '',
  paid_by: 'JM transport',
  status: 'Paid',
  payment_source: 'Partner',
  payment_mode: 'Cash',
  card_details: '',
};

const typeColors: Record<string, string> = {
  vehicle: 'bg-blue-100 text-blue-800',
  operational: 'bg-green-100 text-green-800',
  personal: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
};

const categoryColor: Record<string, string> = {
  'Fuel (Diesel)': 'bg-amber-100 text-amber-800',
  'Maintenance': 'bg-blue-100 text-blue-800',
  'Insurance': 'bg-purple-100 text-purple-800',
  'Toll Taxes': 'bg-red-100 text-red-800',
  'Meals': 'bg-green-100 text-green-800',
  'Rent': 'bg-orange-100 text-orange-800',
  'Daily Allowance': 'bg-teal-100 text-teal-800',
  'Advance': 'bg-red-100 text-red-800',
  'Credit Card Payment': 'bg-indigo-100 text-indigo-800',
};

export default function ExpensesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showFilters, setShowFilters] = useState(false);
  const [categoriesByType, setCategoriesByType] = useState(DEFAULT_CATEGORIES_BY_TYPE);
  const [allCategories, setAllCategories] = useState<string[]>(
    buildAllCategoryNames(DEFAULT_CATEGORIES_BY_TYPE),
  );

  // Filters — default to current month
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterType, setFilterType] = useState<ExpenseType | ''>('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [filterPaidByPerson, setFilterPaidByPerson] = useState('');
  const [filterPaidBy, setFilterPaidBy] = useState('');
  const [filterPaymentSource, setFilterPaymentSource] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput);
  const { sortColumn, sortDirection, toggleSort } = useTableSort('date', 'desc');
  const [summary, setSummary] = useState({ total: 0, jmTotal: 0, maheshTotal: 0 });

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalItems: totalExpenses,
    setTotalItems: setTotalExpenses,
    totalPages,
  } = useServerPagination([
    filterType, filterVehicle, filterCategory, filterPerson,
    filterPaidByPerson, filterPaidBy, filterPaymentSource, filterDateFrom, filterDateTo, filterMonth, searchQuery,
    sortColumn, sortDirection,
  ]);

  function applyExpenseFilters<Q>(query: Q): Q {
    let q = query as {
      eq: (col: string, val: string) => typeof q;
      gte: (col: string, val: string) => typeof q;
      lte: (col: string, val: string) => typeof q;
      or: (filter: string) => typeof q;
    };
    if (filterType) q = q.eq('expense_type', filterType);
    if (filterVehicle) q = q.eq('vehicle_number', filterVehicle);
    if (filterCategory) q = q.eq('category', filterCategory);
    if (filterPerson) q = q.eq('person', filterPerson);
    if (filterPaidByPerson) q = q.eq('paid_by_person', filterPaidByPerson);
    if (filterPaidBy) q = q.eq('paid_by', filterPaidBy);
    if (filterPaymentSource) q = q.eq('payment_source', filterPaymentSource);
    if (filterMonth) {
      const [y, m] = filterMonth.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
      q = q.gte('date', start).lte('date', end);
    } else {
      if (filterDateFrom) q = q.gte('date', filterDateFrom);
      if (filterDateTo) q = q.lte('date', filterDateTo);
    }
    const searchFilter = buildTextSearchFilter([...EXPENSE_SEARCH_COLUMNS], searchQuery);
    if (searchFilter) q = q.or(searchFilter);
    return q as Q;
  }

  async function fetchExpenses() {
    setLoading(true);
    const { from, to } = getSupabaseRange(page, pageSize);

    const listQuery = applySupabaseSort(
      applyExpenseFilters(
        supabase.from('expenses').select('*', { count: 'exact' }),
      ),
      sortColumn,
      sortDirection,
    );
    const { data, count, error } = await listQuery.range(from, to);

    const summaryQuery = applyExpenseFilters(supabase.from('expenses').select('amount, paid_by'));
    const { data: summaryRows, error: summaryError } = await summaryQuery;

    if (error) { toast.error('Failed to load expenses: ' + error.message); setLoading(false); return; }
    if (summaryError) { toast.error('Failed to load expense summary: ' + summaryError.message); }

    setExpenses(data || []);
    setTotalExpenses(count ?? 0);
    setSummary({
      total: (summaryRows || []).reduce((sum, e) => sum + Number(e.amount), 0),
      jmTotal: (summaryRows || []).filter((e) => e.paid_by === 'JM transport').reduce((s, e) => s + Number(e.amount), 0),
      maheshTotal: (summaryRows || []).filter((e) => e.paid_by === 'Mahesh').reduce((s, e) => s + Number(e.amount), 0),
    });
    setLoading(false);
  }

  const hasActiveFilters = filterMonth !== currentMonth || !!filterType || !!filterVehicle || !!filterCategory || !!filterPerson || !!filterPaidByPerson || !!filterPaidBy || !!filterPaymentSource || !!filterDateFrom || !!filterDateTo || !!searchQuery;

  function clearFilters() {
    setFilterType(''); setFilterVehicle(''); setFilterCategory('');
    setFilterPerson(''); setFilterPaidByPerson(''); setFilterPaidBy('');
    setFilterPaymentSource('');
    setFilterDateFrom(''); setFilterDateTo(''); setFilterMonth(currentMonth);
    setSearchInput('');
  }

  // Active filter labels
  const activeFilterLabels: string[] = [];
  if (filterMonth) {
    const d = new Date(filterMonth + '-01');
    activeFilterLabels.push(d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
  } else if (!filterDateFrom && !filterDateTo) {
    activeFilterLabels.push('All months');
  }
  if (filterDateFrom) activeFilterLabels.push('From: ' + filterDateFrom);
  if (filterDateTo) activeFilterLabels.push('To: ' + filterDateTo);
  if (filterType) activeFilterLabels.push('Type: ' + filterType);
  if (filterPaidBy) activeFilterLabels.push('Entity: ' + filterPaidBy);
  if (filterPaidByPerson) activeFilterLabels.push('Paid by: ' + filterPaidByPerson);
  if (filterPerson) activeFilterLabels.push('Given to: ' + filterPerson);
  if (filterVehicle) activeFilterLabels.push('Vehicle: ' + filterVehicle);
  if (filterCategory) activeFilterLabels.push('Category: ' + filterCategory);
  if (filterPaymentSource) activeFilterLabels.push('Paid from: ' + filterPaymentSource);
  if (searchQuery) activeFilterLabels.push('Search: ' + searchQuery);

  useEffect(() => {
    fetchExpenses();
  }, [page, pageSize, filterType, filterVehicle, filterCategory, filterPerson, filterPaidByPerson, filterPaidBy, filterPaymentSource, filterDateFrom, filterDateTo, filterMonth, searchQuery, sortColumn, sortDirection]);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setEditingId(null);
      setForm(emptyForm);
      setDialogOpen(true);
      router.replace('/expenses', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchExpenseCategories().then(({ data, error }) => {
      if (error) toast.error('Failed to load categories: ' + error);
      const byType = buildCategoriesByType(data);
      setCategoriesByType(byType);
      setAllCategories(buildAllCategoryNames(byType));
    });
  }, []);

  useEffect(() => {
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: { vehicle_number: string }) => v.vehicle_number));
    });
    supabase.from('partners').select('name').order('name').then(({ data }) => {
      setPartners((data || []).map((p: { name: string }) => p.name));
    });
  }, []);

  function handleTypeChange(type: ExpenseType) {
    const categories = categoriesByType[type];
    setForm((f) => ({
      ...f,
      expense_type: type,
      category: categories.includes(f.category) ? f.category : '',
      vehicle_number: type === 'vehicle' ? f.vehicle_number : '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { payment_mode, card_details, ...rest } = form;
    const payload = {
      ...rest,
      vehicle_number: form.expense_type === 'vehicle' ? form.vehicle_number : null,
      person: form.person || null,
      paid_by_person: form.paid_by_person || null,
    };
    if (editingId) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Expense updated');
    } else {
      const { error } = await supabase.from('expenses').insert(payload);
      if (error) { toast.error(error.message); return; }

      // Auto-create capital contribution if paid by partner
      if (form.payment_source === 'Partner' && form.paid_by_person) {
        const { error: ccErr } = await supabase.from('capital_contributions').insert({
          date: form.date,
          contributor: form.paid_by_person,
          contribution_type: form.payment_mode,
          value: Number(form.amount),
          description: form.description || form.category,
          asset_details: form.payment_mode === 'Credit Card' ? form.card_details : null,
          status: 'Unpaid',
          paid_by: 'JM transport',
        });
        if (ccErr) toast.error('Expense saved but capital entry failed: ' + ccErr.message);
        else toast.success('Expense added + capital contribution recorded');
      } else {
        toast.success('Expense added');
      }
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchExpenses();
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setForm({
      date: exp.date,
      expense_type: exp.expense_type,
      vehicle_number: exp.vehicle_number || '',
      category: exp.category,
      amount: Number(exp.amount),
      description: exp.description || '',
      person: exp.person || '',
      paid_by_person: exp.paid_by_person || '',
      bill_receipt_ref: exp.bill_receipt_ref || '',
      paid_by: exp.paid_by,
      status: exp.status,
      payment_source: exp.payment_source || 'Partner',
      payment_mode: 'Cash',
      card_details: '',
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this expense?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Expense deleted');
    fetchExpenses();
  }

  const availableCategories = form.expense_type ? categoriesByType[form.expense_type] : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: 'Search description, category, vehicle...',
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        filterLabels={activeFilterLabels}
      />
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Expense' : 'New Expense'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Expense Type</Label>
                  <div className="flex gap-2 mt-1">
                    {EXPENSE_TYPES.map((t) => (
                      <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${form.expense_type === t.value ? typeColors[t.value] : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                {form.expense_type === 'vehicle' && (
                  <div>
                    <Label>Vehicle</Label>
                    <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} required>
                      <option value="">Select</option>
                      {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <Label>Category</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    <option value="">Select</option>
                    {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Amount ({'\u20B9'})</Label>
                  <Input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <Label>Paid By (Entity)</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })}>
                    <option value="JM transport">JM Transport</option>
                    <option value="Mahesh">Mahesh</option>
                  </select>
                </div>
                <div>
                  <Label>Paid By (Person)</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.paid_by_person} onChange={(e) => setForm({ ...form, paid_by_person: e.target.value })}>
                    <option value="">Select</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Given To</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
                    <option value="">Select</option>
                    {partners.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div>
                  <Label>Paid From</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.payment_source} onChange={(e) => setForm({ ...form, payment_source: e.target.value })}>
                    {PAYMENT_SOURCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {form.payment_source === 'Partner' && !editingId && (
                  <>
                    <div>
                      <Label>Payment Mode</Label>
                      <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                        <option value="Cash">Cash</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    {form.payment_mode === 'Credit Card' && (
                      <div>
                        <Label>Card Details</Label>
                        <Input value={form.card_details} onChange={(e) => setForm({ ...form, card_details: e.target.value })} placeholder="e.g. HDFC CC" />
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Expense</Button>
            </form>
          </DialogContent>
        </Dialog>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total)}</p>
            <p className="text-xs text-gray-400">{expenses.length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-sky-600 uppercase tracking-wide">JM Transport</p>
            <p className="text-2xl font-bold text-sky-700">{formatCurrency(summary.jmTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-orange-600 uppercase tracking-wide">Mahesh</p>
            <p className="text-2xl font-bold text-orange-700">{formatCurrency(summary.maheshTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          All
        </button>
        {EXPENSE_TYPES.map((t) => (
          <button key={t.value} onClick={() => setFilterType(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === t.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
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
                  <label className="text-xs text-gray-500 mb-1 block">Category</label>
                  <select className={FILTER_SELECT_CLASS} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="">All</option>
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Paid From</label>
                  <select className={FILTER_SELECT_CLASS} value={filterPaymentSource} onChange={(e) => setFilterPaymentSource(e.target.value)}>
                    <option value="">All</option>
                    {PAYMENT_SOURCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                  <X className="h-3 w-3" /> Clear all filters
                </button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Date" column="date" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                  <TableHead>Type</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Category</TableHead>
                  <SortableTableHead label="Amount" column="amount" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} className="text-right" />
                  <TableHead>Description</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead>Given To</TableHead>
                  <TableHead>Paid From</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-gray-500">No expenses found</TableCell></TableRow>
                ) : (
                  expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(exp.date)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[exp.expense_type]}`}>
                          {exp.expense_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {exp.vehicle_number ? <Badge variant="outline">{exp.vehicle_number}</Badge> : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColor[exp.category] || 'bg-gray-100 text-gray-800'}`}>
                          {exp.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600 whitespace-nowrap">{formatCurrency(Number(exp.amount))}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{exp.description}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${exp.paid_by === 'Mahesh' ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800'}`}>
                          {exp.paid_by === 'JM transport' ? 'JM' : 'Mahesh'}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{exp.paid_by_person || <span className="text-gray-300">-</span>}</TableCell>
                      <TableCell className="whitespace-nowrap">{exp.person || <span className="text-gray-300">-</span>}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${exp.payment_source === 'Revenue' ? 'bg-green-100 text-green-800' : 'bg-violet-100 text-violet-800'}`}>
                          {exp.payment_source || 'Partner'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(exp)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={totalExpenses}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
