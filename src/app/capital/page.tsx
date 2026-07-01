'use client';

import { useEffect, useState } from 'react';
import { supabase, CapitalContribution, JM_PARTNERS, PAYMENT_SOURCES } from '@/lib/supabase';
import {
  cardAssetDetails,
  fetchCreditCards,
  filterCardsByHolder,
  formatCardLabel,
  formatCardOption,
  type CreditCard,
} from '@/lib/credit-cards';
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
import { Plus, Pencil, Trash2, CheckCircle2, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/pagination-controls';
import { PageHeader } from '@/components/page-header';
import { ActiveFiltersBar } from '@/components/active-filters-bar';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';
import { buildTextSearchFilter, CAPITAL_SEARCH_COLUMNS } from '@/lib/search';
import { applySupabaseSort } from '@/lib/sort';
import { useTableSort } from '@/hooks/use-table-sort';
import { SortableTableHead } from '@/components/sortable-table-head';

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  contributor: '',
  contribution_type: 'Credit Card',
  value: 0,
  description: '',
  asset_details: '',
  credit_card_id: '',
  status: 'Unpaid',
  paid_date: '',
  paid_by: 'JM transport',
};

export default function CapitalPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [contributions, setContributions] = useState<CapitalContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [payingIds, setPayingIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [cardsTableMissing, setCardsTableMissing] = useState(false);
  const [payForm, setPayForm] = useState({ paid_date: new Date().toISOString().split('T')[0], paid_by: 'JM transport', payment_source: 'Revenue' });
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterContributor, setFilterContributor] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCreditCard, setFilterCreditCard] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput);
  const { sortColumn, sortDirection, toggleSort } = useTableSort('date', 'desc');
  const [summary, setSummary] = useState({
    total: 0,
    paidTotal: 0,
    unpaidTotal: 0,
    contributorTotals: {} as Record<string, { total: number; paid: number; unpaid: number }>,
  });

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalItems: totalContributionsCount,
    setTotalItems: setTotalContributionsCount,
    totalPages,
  } = useServerPagination([
    filterStatus, filterContributor, filterMonth, filterDateFrom, filterDateTo,
    filterCreditCard, searchQuery, sortColumn, sortDirection,
  ]);

  function applyCapitalFilters<Q>(query: Q): Q {
    let q = query as {
      eq: (col: string, val: string | number) => typeof q;
      gte: (col: string, val: string) => typeof q;
      lte: (col: string, val: string) => typeof q;
      or: (filter: string) => typeof q;
    };
    if (filterStatus) q = q.eq('status', filterStatus);
    if (filterContributor) q = q.eq('contributor', filterContributor);
    if (filterCreditCard) q = q.eq('card_id', Number(filterCreditCard));
    if (filterMonth) {
      const [y, m] = filterMonth.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
      q = q.gte('date', start).lte('date', end);
    } else {
      if (filterDateFrom) q = q.gte('date', filterDateFrom);
      if (filterDateTo) q = q.lte('date', filterDateTo);
    }
    const searchFilter = buildTextSearchFilter([...CAPITAL_SEARCH_COLUMNS], searchQuery);
    if (searchFilter) q = q.or(searchFilter);
    return q as Q;
  }

  async function fetchData() {
    setLoading(true);
    const { from, to } = getSupabaseRange(page, pageSize);

    const listQuery = applySupabaseSort(
      applyCapitalFilters(
        supabase.from('capital_contributions').select('*', { count: 'exact' }),
      ),
      sortColumn,
      sortDirection,
    );
    const { data, count, error } = await listQuery.range(from, to);

    const summaryQuery = applyCapitalFilters(
      supabase.from('capital_contributions').select('value, status, contributor'),
    );
    const { data: summaryRows, error: summaryError } = await summaryQuery;

    if (error) { toast.error('Failed to load contributions: ' + error.message); setLoading(false); return; }
    if (summaryError) { toast.error('Failed to load summary: ' + summaryError.message); }

    const contributorTotals: Record<string, { total: number; paid: number; unpaid: number }> = {};
    (summaryRows || []).forEach((c) => {
      if (!contributorTotals[c.contributor]) contributorTotals[c.contributor] = { total: 0, paid: 0, unpaid: 0 };
      const amt = Number(c.value);
      contributorTotals[c.contributor].total += amt;
      if (c.status === 'Paid') contributorTotals[c.contributor].paid += amt;
      else contributorTotals[c.contributor].unpaid += amt;
    });

    setContributions(data || []);
    setTotalContributionsCount(count ?? 0);
    setSummary({
      total: (summaryRows || []).reduce((sum, c) => sum + Number(c.value), 0),
      paidTotal: (summaryRows || []).filter((c) => c.status === 'Paid').reduce((sum, c) => sum + Number(c.value), 0),
      unpaidTotal: (summaryRows || []).filter((c) => c.status !== 'Paid').reduce((sum, c) => sum + Number(c.value), 0),
      contributorTotals,
    });
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [
    page, pageSize, filterStatus, filterContributor, filterMonth, filterDateFrom,
    filterDateTo, filterCreditCard, searchQuery, sortColumn, sortDirection,
  ]);

  useEffect(() => {
    setSelectedIds([]);
  }, [
    page, pageSize, filterStatus, filterContributor, filterMonth, filterDateFrom,
    filterDateTo, filterCreditCard, searchQuery, sortColumn, sortDirection,
  ]);

  useEffect(() => {
    fetchCreditCards().then(({ data, tableMissing }) => {
      setCreditCards(data);
      setCardsTableMissing(tableMissing);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cardId = form.credit_card_id ? Number(form.credit_card_id) : null;
    const selectedCard = creditCards.find((c) => c.id === cardId);

    if (form.contribution_type === 'Credit Card') {
      if (cardsTableMissing) {
        toast.error('Credit cards not set up. Run supabase/credit_cards.sql in Supabase, then add cards in Admin.');
        return;
      }
      if (!form.contributor) {
        toast.error('Select a contributor first');
        return;
      }
      const cardsForHolder = filterCardsByHolder(creditCards, form.contributor);
      if (cardsForHolder.length === 0) {
        toast.error(`No credit cards for ${form.contributor}. Add one in Admin → Credit Cards.`);
        return;
      }
      if (!cardId) {
        toast.error('Credit card is required when type is Credit Card');
        return;
      }
    }

    const payload = {
      date: form.date,
      contributor: form.contributor,
      contribution_type: form.contribution_type,
      value: form.value,
      description: form.description || null,
      asset_details: form.contribution_type === 'Credit Card'
        ? cardAssetDetails(selectedCard, '')
        : (form.asset_details || null),
      status: form.status,
      paid_by: form.paid_by,
      paid_date: form.status === 'Paid' ? (form.paid_date || form.date) : null,
      ...(form.contribution_type === 'Credit Card' && cardId ? { card_id: cardId } : {}),
    };
    if (editingId) {
      const { error } = await supabase.from('capital_contributions').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Contribution updated');
    } else {
      const { error } = await supabase.from('capital_contributions').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Contribution added');
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchData();
  }

  function startEdit(c: CapitalContribution) {
    setEditingId(c.id);
    setForm({
      date: c.date,
      contributor: c.contributor,
      contribution_type: c.contribution_type,
      value: Number(c.value),
      description: c.description || '',
      asset_details: c.asset_details || '',
      credit_card_id: c.card_id ? String(c.card_id) : '',
      status: c.status,
      paid_date: c.paid_date || '',
      paid_by: c.paid_by || 'JM transport',
    });
    setDialogOpen(true);
  }

  function startPay(c: CapitalContribution) {
    setPayingIds([c.id]);
    setPayForm({ paid_date: new Date().toISOString().split('T')[0], paid_by: 'JM transport', payment_source: 'Revenue' });
    setPayDialogOpen(true);
  }

  function startBulkPay() {
    const ids = selectedIds.filter((id) => {
      const row = contributions.find((c) => c.id === id);
      return row && row.status !== 'Paid';
    });
    if (ids.length === 0) {
      toast.error('Select unpaid contributions to mark as paid');
      return;
    }
    setPayingIds(ids);
    setPayForm({ paid_date: new Date().toISOString().split('T')[0], paid_by: 'JM transport', payment_source: 'Revenue' });
    setPayDialogOpen(true);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const unpaidOnPage = contributions.filter((c) => c.status !== 'Paid');
  const allUnpaidOnPageSelected =
    unpaidOnPage.length > 0 && unpaidOnPage.every((c) => selectedIds.includes(c.id));

  function toggleSelectAllOnPage() {
    if (allUnpaidOnPageSelected) {
      const pageIds = new Set(unpaidOnPage.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...unpaidOnPage.map((c) => c.id)])]);
    }
  }

  const selectedUnpaidTotal = contributions
    .filter((c) => selectedIds.includes(c.id) && c.status !== 'Paid')
    .reduce((sum, c) => sum + Number(c.value), 0);

  const payingTotal = contributions
    .filter((c) => payingIds.includes(c.id))
    .reduce((sum, c) => sum + Number(c.value), 0);

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault();
    if (payingIds.length === 0) return;
    const ids = payingIds;
    const { error } = await supabase.from('capital_contributions')
      .update({
        status: 'Paid',
        paid_date: payForm.paid_date,
        paid_by: payForm.paid_by,
        payment_source: payForm.payment_source,
      })
      .in('id', ids);
    if (error) { toast.error(error.message); return; }
    toast.success(ids.length === 1 ? 'Marked as paid' : `${ids.length} contributions marked as paid`);
    setPayDialogOpen(false);
    setPayingIds([]);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    fetchData();
  }

  async function handleMarkUnpaid(id: number) {
    const { error } = await supabase.from('capital_contributions')
      .update({ status: 'Unpaid', paid_date: null })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Marked as unpaid');
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this contribution?')) return;
    const { error } = await supabase.from('capital_contributions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Contribution deleted');
    fetchData();
  }

  const contributorTotals = summary.contributorTotals;
  const holderCards = filterCardsByHolder(creditCards, form.contributor);

  function cardDisplay(c: CapitalContribution) {
    if (c.card_id) {
      const card = creditCards.find((x) => x.id === c.card_id);
      if (card) return formatCardLabel(card);
    }
    return c.asset_details || '-';
  }

  const hasActiveFilters =
    filterMonth !== currentMonth ||
    !!filterDateFrom ||
    !!filterDateTo ||
    !!filterStatus ||
    !!filterContributor ||
    !!filterCreditCard ||
    !!searchQuery;

  function clearFilters() {
    setFilterMonth(currentMonth);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('');
    setFilterContributor('');
    setFilterCreditCard('');
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
  if (filterStatus) activeFilterLabels.push('Status: ' + filterStatus);
  if (filterContributor) activeFilterLabels.push('Contributor: ' + filterContributor);
  if (filterCreditCard) {
    const card = creditCards.find((c) => String(c.id) === filterCreditCard);
    activeFilterLabels.push('Card: ' + (card ? formatCardLabel(card) : filterCreditCard));
  }
  if (searchQuery) activeFilterLabels.push('Search: ' + searchQuery);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Capital Contributions"
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: 'Search contributor, description...',
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        clearFiltersLabel="Reset filters"
        actions={
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Contribution
          </Button>
        }
      />

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Contribution' : 'New Contribution'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div>
                  <Label>Contributor</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.contributor} onChange={(e) => setForm({ ...form, contributor: e.target.value, credit_card_id: '' })} required>
                    <option value="">Select</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Type</Label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.contribution_type} onChange={(e) => setForm({ ...form, contribution_type: e.target.value, credit_card_id: '', asset_details: '' })}>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <Label>Amount ({'\u20B9'})</Label>
                  <Input type="number" step="0.01" value={form.value || ''} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} required />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                {form.contribution_type === 'Credit Card' ? (
                  <div className="col-span-2">
                    <Label>Credit Card *</Label>
                    {!form.contributor ? (
                      <p className="text-sm text-gray-500 py-2">Select a contributor first</p>
                    ) : cardsTableMissing ? (
                      <p className="text-sm text-amber-600 py-2">
                        Run supabase/credit_cards.sql in Supabase, then add cards in Admin → Credit Cards.
                      </p>
                    ) : holderCards.length > 0 ? (
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={form.credit_card_id}
                        onChange={(e) => setForm({ ...form, credit_card_id: e.target.value, asset_details: '' })}
                        required
                      >
                        <option value="">Select card</option>
                        {holderCards.map((c) => (
                          <option key={c.id} value={c.id}>{formatCardOption(c)}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-amber-600 py-2">
                        No cards for {form.contributor}. Add one in Admin → Credit Cards.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="col-span-2">
                    <Label>Asset Details</Label>
                    <Input value={form.asset_details} onChange={(e) => setForm({ ...form, asset_details: e.target.value })} placeholder="Optional notes" />
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Contribution</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Mark as Paid Dialog */}
        <Dialog open={payDialogOpen} onOpenChange={(open) => { setPayDialogOpen(open); if (!open) setPayingIds([]); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {payingIds.length > 1 ? `Mark ${payingIds.length} as Paid` : 'Mark as Paid'}
              </DialogTitle>
            </DialogHeader>
            {payingIds.length > 0 && (
              <p className="text-sm text-gray-600">
                Total: <span className="font-semibold text-green-700">{formatCurrency(payingTotal)}</span>
              </p>
            )}
            <form onSubmit={handleMarkPaid} className="space-y-4">
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={payForm.paid_date} onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })} required />
              </div>
              <div>
                <Label>Paid From</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={payForm.payment_source} onChange={(e) => setPayForm({ ...payForm, payment_source: e.target.value })}>
                  {PAYMENT_SOURCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Confirm Payment</Button>
            </form>
          </DialogContent>
        </Dialog>

      <ActiveFiltersBar
        labels={activeFilterLabels}
        onClear={hasActiveFilters ? clearFilters : undefined}
        clearLabel="Reset filters"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Contributed</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total)}</p>
            <p className="text-xs text-gray-400">{contributions.length} entries</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-xs text-green-600 uppercase tracking-wide">Paid Back</p>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.paidTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-amber-600 uppercase tracking-wide">Unpaid</p>
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(summary.unpaidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-contributor breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(contributorTotals).map(([name, t]) => (
          <Card key={name}>
            <CardContent className="py-3 px-4">
              <p className="text-sm font-medium text-gray-700">{name}</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(t.total)}</p>
              <div className="flex gap-3 text-xs mt-1">
                <span className="text-green-600">{formatCurrency(t.paid)} paid</span>
                <span className="text-amber-600">{formatCurrency(t.unpaid)} due</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status + Advanced Filters */}
      <div className="space-y-2">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setFilterStatus('')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterStatus === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              All
            </button>
            <button onClick={() => setFilterStatus('Unpaid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterStatus === 'Unpaid' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500'}`}>
              Unpaid
            </button>
            <button onClick={() => setFilterStatus('Paid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${filterStatus === 'Paid' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>
              Paid
            </button>
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium">
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Advanced Filters
            {hasActiveFilters && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">Active</span>}
          </button>
        </div>

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
                  <label className="text-xs text-gray-500 mb-1 block">Contributor</label>
                  <select className={FILTER_SELECT_CLASS} value={filterContributor} onChange={(e) => setFilterContributor(e.target.value)}>
                    <option value="">All</option>
                    {JM_PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Credit Card</label>
                  <select className={FILTER_SELECT_CLASS} value={filterCreditCard} onChange={(e) => setFilterCreditCard(e.target.value)}>
                    <option value="">All cards</option>
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>{formatCardOption(c)}</option>
                    ))}
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

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-sm font-medium text-green-900">
            {selectedIds.length} selected · {formatCurrency(selectedUnpaidTotal)} unpaid
          </span>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={startBulkPay}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as Paid
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allUnpaidOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      disabled={unpaidOnPage.length === 0}
                      aria-label="Select all unpaid on page"
                      className="rounded border-gray-300"
                    />
                  </TableHead>
                  <SortableTableHead label="Date" column="date" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                  <TableHead>Contributor</TableHead>
                  <TableHead>Type</TableHead>
                  <SortableTableHead label="Amount" column="value" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} className="text-right" />
                  <TableHead>Description</TableHead>
                  <TableHead>Card/Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid From</TableHead>
                  <SortableTableHead label="Paid Date" column="paid_date" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : contributions.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-gray-500">No contributions found</TableCell></TableRow>
                ) : (
                  contributions.map((c) => (
                    <TableRow key={c.id} className={c.status === 'Paid' ? 'bg-green-50/50' : selectedIds.includes(c.id) ? 'bg-blue-50/40' : ''}>
                      <TableCell>
                        {c.status !== 'Paid' ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            aria-label={`Select contribution ${c.id}`}
                            className="rounded border-gray-300"
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(c.date)}</TableCell>
                      <TableCell className="font-medium">{c.contributor}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {c.contribution_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600 whitespace-nowrap">{formatCurrency(Number(c.value))}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{c.description}</TableCell>
                      <TableCell className="text-gray-500">{cardDisplay(c)}</TableCell>
                      <TableCell>
                        {c.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3" /> Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Clock className="h-3 w-3" /> Unpaid
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.payment_source ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.payment_source === 'Revenue' ? 'bg-green-100 text-green-800' : 'bg-violet-100 text-violet-800'}`}>
                            {c.payment_source}
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-500">
                        {c.paid_date ? formatDate(c.paid_date) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {c.status !== 'Paid' ? (
                            <Button variant="ghost" size="icon" onClick={() => startPay(c)} title="Mark as Paid">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleMarkUnpaid(c.id)} title="Mark as Unpaid">
                              <Clock className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
            totalItems={totalContributionsCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
