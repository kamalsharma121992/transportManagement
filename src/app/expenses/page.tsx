'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, Expense, ExpenseType, EXPENSE_TYPES, JM_PARTNERS, PAYMENT_SOURCES, EXPENSE_ADVANCE_CATEGORY } from '@/lib/supabase';
import {
  buildAllCategoryNames,
  buildCategoriesByType,
  DEFAULT_CATEGORIES_BY_TYPE,
  fetchExpenseCategories,
  FUEL_CATEGORY,
  paymentModeForCategory,
} from '@/lib/expense-categories';
import {
  cardAssetDetails,
  fetchCreditCards,
  filterCardsByHolder,
  formatCardOption,
  type CreditCard,
} from '@/lib/credit-cards';
import { createExpenseAdvanceFromExpense } from '@/lib/expense-advances';
import { formatCurrency, formatDate, getMonthFilterOptions, getMonthDateRange, FILTER_SELECT_CLASS } from '@/lib/format';
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
import { ActiveFiltersBar } from '@/components/active-filters-bar';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { applyInFilter, formatMultiFilterLabel } from '@/lib/filter-helpers';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';
import { buildTextSearchFilter, EXPENSE_SEARCH_COLUMNS } from '@/lib/search';
import { applySupabaseSort } from '@/lib/sort';
import { useTableSort } from '@/hooks/use-table-sort';
import { SortableTableHead } from '@/components/sortable-table-head';
import { cn } from '@/lib/utils';

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
  credit_card_id: '',
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
  'Expense Advance': 'bg-orange-100 text-orange-800',
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
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showFilters, setShowFilters] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [categoriesByType, setCategoriesByType] = useState(DEFAULT_CATEGORIES_BY_TYPE);
  const [allCategories, setAllCategories] = useState<string[]>(
    buildAllCategoryNames(DEFAULT_CATEGORIES_BY_TYPE).filter((c) => c !== EXPENSE_ADVANCE_CATEGORY),
  );
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [cardsTableMissing, setCardsTableMissing] = useState(false);

  // Filters — default to current month
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterType, setFilterType] = useState<ExpenseType | ''>('');
  const [filterVehicles, setFilterVehicles] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterPersons, setFilterPersons] = useState<string[]>([]);
  const [filterPaidByPersons, setFilterPaidByPersons] = useState<string[]>([]);
  const [filterPaidByEntities, setFilterPaidByEntities] = useState<string[]>([]);
  const [filterPaymentSources, setFilterPaymentSources] = useState<string[]>([]);
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
    filterType, filterVehicles, filterCategories, filterPersons,
    filterPaidByPersons, filterPaidByEntities, filterPaymentSources, filterDateFrom, filterDateTo, filterMonth, searchQuery,
    sortColumn, sortDirection,
  ]);

  function applyExpenseFilters<Q>(query: Q): Q {
    let q = query as {
      eq: (col: string, val: string) => typeof q;
      neq: (col: string, val: string) => typeof q;
      in: (col: string, vals: string[]) => typeof q;
      gte: (col: string, val: string) => typeof q;
      lte: (col: string, val: string) => typeof q;
      or: (filter: string) => typeof q;
    };
    // Float only — tracked on Expense Advances page (avoid double-count in P&L)
    q = q.neq('category', EXPENSE_ADVANCE_CATEGORY);
    if (filterType) q = q.eq('expense_type', filterType);
    q = applyInFilter(q, 'vehicle_number', filterVehicles);
    q = applyInFilter(q, 'category', filterCategories);
    q = applyInFilter(q, 'person', filterPersons);
    q = applyInFilter(q, 'paid_by_person', filterPaidByPersons);
    q = applyInFilter(q, 'paid_by', filterPaidByEntities);
    q = applyInFilter(q, 'payment_source', filterPaymentSources);
    if (filterMonth) {
      const { from, to } = getMonthDateRange(filterMonth);
      q = q.gte('date', from).lte('date', to);
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

  const hasActiveFilters = filterMonth !== currentMonth || !!filterType || filterVehicles.length > 0 || filterCategories.length > 0 || filterPersons.length > 0 || filterPaidByPersons.length > 0 || filterPaidByEntities.length > 0 || filterPaymentSources.length > 0 || !!filterDateFrom || !!filterDateTo || !!searchQuery;

  function clearFilters() {
    setFilterType(''); setFilterVehicles([]); setFilterCategories([]);
    setFilterPersons([]); setFilterPaidByPersons([]); setFilterPaidByEntities([]);
    setFilterPaymentSources([]);
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
  if (filterType) {
    const typeLabel = EXPENSE_TYPES.find((t) => t.value === filterType)?.label ?? filterType;
    activeFilterLabels.push('Type: ' + typeLabel);
  }
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
  if (filterCategories.length > 0) {
    const label = formatMultiFilterLabel('Categor' + (filterCategories.length > 1 ? 'ies' : 'y'), filterCategories);
    if (label) activeFilterLabels.push(label);
  }
  if (filterPaymentSources.length > 0) {
    const label = formatMultiFilterLabel('Paid from', filterPaymentSources);
    if (label) activeFilterLabels.push(label);
  }
  if (searchQuery) activeFilterLabels.push('Search: ' + searchQuery);

  useEffect(() => {
    setExpandedId(null);
    fetchExpenses();
  }, [page, pageSize, filterType, filterVehicles, filterCategories, filterPersons, filterPaidByPersons, filterPaidByEntities, filterPaymentSources, filterDateFrom, filterDateTo, filterMonth, searchQuery, sortColumn, sortDirection]);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setEditingId(null);
      setForm(emptyForm);
      setDialogOpen(true);
      router.replace('/expenses', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchCreditCards().then(({ data, tableMissing }) => {
      setCreditCards(data);
      setCardsTableMissing(tableMissing);
    });
  }, []);

  useEffect(() => {
    fetchExpenseCategories().then(({ data, error }) => {
      if (error) toast.error('Failed to load categories: ' + error);
      const byType = buildCategoriesByType(data);
      setCategoriesByType(byType);
      setAllCategories(buildAllCategoryNames(byType).filter((c) => c !== EXPENSE_ADVANCE_CATEGORY));
    });
  }, []);

  useEffect(() => {
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: { vehicle_number: string }) => v.vehicle_number));
    });
    supabase.from('partners').select('name').order('name').then(({ data: partnerRows }) => {
      supabase.from('drivers').select('name').order('name').then(({ data: driverRows }) => {
        const names = new Set<string>();
        (partnerRows || []).forEach((p: { name: string }) => names.add(p.name));
        (driverRows || []).forEach((d: { name: string }) => names.add(d.name));
        setPartners([...names].sort((a, b) => a.localeCompare(b)));
      });
    });
  }, []);

  function handleTypeChange(type: ExpenseType) {
    const categories = categoriesByType[type];
    setForm((f) => {
      const category = categories.includes(f.category) ? f.category : '';
      return {
        ...f,
        expense_type: type,
        category,
        vehicle_number: type === 'vehicle' ? f.vehicle_number : '',
        payment_mode: category ? paymentModeForCategory(category) : f.payment_mode,
        credit_card_id: category === FUEL_CATEGORY ? f.credit_card_id : '',
        card_details: category === FUEL_CATEGORY ? f.card_details : '',
      };
    });
  }

  function handleCategoryChange(category: string) {
    setForm((f) => ({
      ...f,
      category,
      payment_mode: paymentModeForCategory(category),
      credit_card_id: category === FUEL_CATEGORY ? f.credit_card_id : '',
      card_details: category === FUEL_CATEGORY ? f.card_details : '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.category === EXPENSE_ADVANCE_CATEGORY && !form.person.trim()) {
      toast.error('Person is required for Expense Advance (who received the cash)');
      return;
    }
    const { payment_mode, card_details, credit_card_id, ...rest } = form;
    const cardId = credit_card_id ? Number(credit_card_id) : null;
    const selectedCard = creditCards.find((c) => c.id === cardId);

    if (
      form.payment_source === 'Partner'
      && payment_mode === 'Credit Card'
      && !cardId
      && !card_details.trim()
      && !cardsTableMissing
      && filterCardsByHolder(creditCards, form.paid_by_person).length > 0
    ) {
      toast.error('Please select a credit card');
      return;
    }

    const useCard =
      form.payment_source === 'Partner'
      && payment_mode === 'Credit Card'
      && cardId
      && !cardsTableMissing;

    const payload = {
      ...rest,
      vehicle_number: form.expense_type === 'vehicle' ? form.vehicle_number : null,
      person: form.person || null,
      paid_by_person: form.paid_by_person || null,
      card_id: useCard ? cardId : null,
    };
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingId);
        if (error) { toast.error(error.message); return; }
        if (form.category === EXPENSE_ADVANCE_CATEGORY) {
          try {
            await createExpenseAdvanceFromExpense({
              id: editingId,
              date: form.date,
              amount: Number(form.amount),
              person: form.person,
              description: form.description || null,
            });
          } catch (syncErr) {
            toast.error(syncErr instanceof Error ? syncErr.message : 'Expense saved but expense advance sync failed');
          }
        }
        toast.success('Expense updated');
      } else {
        const { data: inserted, error } = await supabase.from('expenses').insert(payload).select('id').single();
        if (error) { toast.error(error.message); return; }

        if (form.category === EXPENSE_ADVANCE_CATEGORY && inserted?.id) {
          try {
            await createExpenseAdvanceFromExpense({
              id: inserted.id,
              date: form.date,
              amount: Number(form.amount),
              person: form.person,
              description: form.description || null,
            });
            toast.success('Expense Advance added — track settlement under Expense Advances');
          } catch (syncErr) {
            toast.error(syncErr instanceof Error ? syncErr.message : 'Expense saved but expense advance sync failed');
          }
        } else if (form.payment_source === 'Partner' && form.paid_by_person) {
          const { error: ccErr } = await supabase.from('capital_contributions').insert({
            date: form.date,
            contributor: form.paid_by_person,
            contribution_type: payment_mode,
            value: Number(form.amount),
            description: form.description || form.category,
            asset_details: cardAssetDetails(selectedCard, card_details),
            ...(useCard ? { card_id: cardId } : {}),
            status: 'Unpaid',
            paid_by: 'JM transport',
            payment_source: null,
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
    } finally {
      setSaving(false);
    }
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
      payment_mode: exp.card_id
        ? 'Credit Card'
        : paymentModeForCategory(exp.category),
      credit_card_id: exp.card_id ? String(exp.card_id) : '',
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
  const holderCards = filterCardsByHolder(creditCards, form.paid_by_person);

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
      />
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[calc(100%-1.5rem)]">
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
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.category} onChange={(e) => handleCategoryChange(e.target.value)} required>
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
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.paid_by_person} onChange={(e) => setForm({ ...form, paid_by_person: e.target.value, credit_card_id: '' })}>
                    <option value="">Select</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>
                    Given To
                    {form.category === EXPENSE_ADVANCE_CATEGORY && <span className="text-red-500"> *</span>}
                  </Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={form.person}
                    onChange={(e) => setForm({ ...form, person: e.target.value })}
                    required={form.category === EXPENSE_ADVANCE_CATEGORY}
                  >
                    <option value="">Select</option>
                    {partners.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {form.category === EXPENSE_ADVANCE_CATEGORY && (
                    <p className="text-[10px] text-gray-400 mt-1">Who received the cash — settle later under Expense Advances</p>
                  )}
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
                {form.payment_source === 'Partner' && (
                  <>
                    <div>
                      <Label>Payment Mode</Label>
                      <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value, credit_card_id: '', card_details: '' })}>
                        <option value="Cash">Cash</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    {form.payment_mode === 'Credit Card' && (
                      <div className="col-span-2">
                        <Label>Credit Card</Label>
                        {holderCards.length > 0 ? (
                          <select
                            className="w-full border rounded-md px-3 py-2 text-sm"
                            value={form.credit_card_id}
                            onChange={(e) => setForm({ ...form, credit_card_id: e.target.value, card_details: '' })}
                            required={!cardsTableMissing}
                          >
                            <option value="">Select card</option>
                            {holderCards.map((c) => (
                              <option key={c.id} value={c.id}>{formatCardOption(c)}</option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <Input
                              value={form.card_details}
                              onChange={(e) => setForm({ ...form, card_details: e.target.value })}
                              placeholder="e.g. HDFC VISA (add cards in Admin)"
                            />
                            {!cardsTableMissing && form.paid_by_person && (
                              <p className="text-xs text-amber-600 mt-1">No cards for {form.paid_by_person}. Add one in Admin → Credit Cards.</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {editingId ? 'Update' : 'Add'} Expense
              </Button>
            </form>
          </DialogContent>
        </Dialog>

      <ActiveFiltersBar
        labels={activeFilterLabels}
        onClear={hasActiveFilters ? clearFilters : undefined}
        clearLabel="Reset filters"
      />

      {/* Summary: collapsible Total-only on mobile; full 3 cards on desktop */}
      <div className="md:hidden space-y-2">
        <button
          type="button"
          onClick={() => setShowSummary((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-left shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Summary</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              Total {formatCurrency(summary.total)}
            </p>
          </div>
          {showSummary ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />}
        </button>
        {showSummary && (
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total)}</p>
              <p className="text-xs text-gray-400">{expenses.length} records</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="hidden md:grid grid-cols-3 gap-3">
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
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-fit overflow-x-auto">
        <button onClick={() => setFilterType('')}
          className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          All
        </button>
        {EXPENSE_TYPES.map((t) => (
          <button key={t.value} onClick={() => {
            setFilterType(t.value);
            setFilterCategories((prev) =>
              prev.filter((c) => categoriesByType[t.value].includes(c)),
            );
          }}
            className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === t.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
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
                <MultiSelectFilter
                  label="Entity"
                  options={['JM transport', 'Mahesh']}
                  selected={filterPaidByEntities}
                  onChange={setFilterPaidByEntities}
                  placeholder="All entities"
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
                  placeholder="All vehicles"
                  searchPlaceholder="Search vehicle..."
                />
                <MultiSelectFilter
                  label="Category"
                  options={allCategories}
                  selected={filterCategories}
                  onChange={setFilterCategories}
                  placeholder="All categories"
                  searchPlaceholder="Search categories..."
                />
                <MultiSelectFilter
                  label="Paid From"
                  options={PAYMENT_SOURCES}
                  selected={filterPaymentSources}
                  onChange={setFilterPaymentSources}
                  placeholder="All"
                  searchPlaceholder="Search source..."
                />
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">Loading...</CardContent>
          </Card>
        ) : expenses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">No expenses found</CardContent>
          </Card>
        ) : (
          expenses.map((exp) => {
            const expanded = expandedId === exp.id;
            return (
              <Card key={exp.id}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="w-full text-left p-4 space-y-2"
                    onClick={() => setExpandedId(expanded ? null : exp.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base truncate">
                          <span className="font-normal text-gray-500">Given to: </span>
                          <span className="font-bold text-gray-900">{exp.person || '—'}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(exp.date)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', categoryColor[exp.category] || 'bg-gray-100 text-gray-800')}>
                            {exp.category}
                          </span>
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', typeColors[exp.expense_type])}>
                            {exp.expense_type}
                          </span>
                          {exp.vehicle_number && (
                            <Badge variant="outline" className="text-xs">{exp.vehicle_number}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold text-red-600">{formatCurrency(Number(exp.amount))}</p>
                      </div>
                    </div>
                    {exp.description && (
                      <p className={cn('text-sm text-gray-600', !expanded && 'line-clamp-1')}>
                        {exp.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{expanded ? 'Hide details' : 'Tap for details'}</span>
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t px-4 py-3 space-y-2 bg-gray-50/80">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Entity</p>
                          <p>
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              exp.paid_by === 'Mahesh' ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800',
                            )}>
                              {exp.paid_by === 'JM transport' ? 'JM' : 'Mahesh'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Paid by</p>
                          <p className="font-medium text-gray-800">{exp.paid_by_person || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Paid from</p>
                          <p>
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              exp.payment_source === 'Revenue' ? 'bg-green-100 text-green-800' : 'bg-violet-100 text-violet-800',
                            )}>
                              {exp.payment_source || 'Partner'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Status</p>
                          <p className="font-medium text-gray-800">{exp.status || '—'}</p>
                        </div>
                        {exp.bill_receipt_ref && (
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase text-gray-500">Bill / receipt</p>
                            <p className="font-medium text-gray-800 break-all">{exp.bill_receipt_ref}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => { e.stopPropagation(); startEdit(exp); }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-600 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
        <Card>
          <CardContent className="p-0">
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

      {/* Desktop table */}
      <Card className="hidden md:block">
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
