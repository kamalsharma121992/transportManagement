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
import { removeExpenseImageMany, uploadExpenseImageMany, validateExpenseImageFile } from '@/lib/expense-image';
import { MAX_ENTITY_IMAGES, normalizeImageUrls } from '@/lib/image-urls';
import { MultiImageField } from '@/components/multi-image-field';
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
import { Pencil, Trash2, ChevronDown, ChevronUp, X, Download, FileText, ImageIcon, Loader2 } from 'lucide-react';
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
import { downloadExpensesCsv, expenseExportSuffix, expenseExportTotals, printExpensesPdf } from '@/lib/expense-export';

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
  const [exporting, setExporting] = useState(false);
  const [expenseImageUrls, setExpenseImageUrls] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [removedImageUrls, setRemovedImageUrls] = useState<string[]>([]);
  const [imageGallery, setImageGallery] = useState<string[]>([]);
  const [imageGalleryIndex, setImageGalleryIndex] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Record<number, Expense>>({});

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

  async function fetchAllFilteredExpenses(): Promise<Expense[]> {
    const batchSize = 1000;
    const all: Expense[] = [];
    let from = 0;
    while (true) {
      const to = from + batchSize - 1;
      const query = applySupabaseSort(
        applyExpenseFilters(supabase.from('expenses').select('*')),
        sortColumn,
        sortDirection,
      );
      const { data, error } = await query.range(from, to);
      if (error) throw error;
      const batch = (data || []) as Expense[];
      all.push(...batch);
      if (batch.length < batchSize) break;
      from += batchSize;
    }
    return all;
  }

  async function handleExport(format: 'csv' | 'pdf', scope: 'filtered' | 'selected' = 'filtered') {
    setExporting(true);
    try {
      let rows: Expense[];
      let filterLabel: string;
      let suffix: string;

      if (scope === 'selected') {
        rows = Object.values(selectedMap);
        if (rows.length === 0) {
          toast.error('Select at least one expense to export');
          return;
        }
        filterLabel = `Selected (${rows.length})`;
        suffix = `selected-${rows.length}`;
      } else {
        rows = await fetchAllFilteredExpenses();
        if (rows.length === 0) {
          toast.error('No expenses to export');
          return;
        }
        suffix = expenseExportSuffix(filterMonth, filterDateFrom, filterDateTo);
        filterLabel = activeFilterLabels.length > 0 ? activeFilterLabels.join(' · ') : 'All expenses';
      }

      const totals = expenseExportTotals(rows);
      if (format === 'csv') {
        downloadExpensesCsv(rows, suffix);
      } else {
        printExpensesPdf({
          expenses: rows,
          filterLabel,
          ...totals,
          generatedOn: new Date().toISOString().split('T')[0],
        });
      }
      toast.success(`Exported ${rows.length} expense(s) as ${format.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  function toggleSelect(exp: Expense) {
    setSelectedMap((prev) => {
      if (prev[exp.id]) {
        const next = { ...prev };
        delete next[exp.id];
        return next;
      }
      return { ...prev, [exp.id]: exp };
    });
  }

  const selectedIds = Object.keys(selectedMap).map(Number);
  const selectedCount = selectedIds.length;
  const selectedTotal = selectedIds.reduce((sum, id) => sum + Number(selectedMap[id]?.amount || 0), 0);
  const allOnPageSelected =
    expenses.length > 0 && expenses.every((e) => selectedMap[e.id]);

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        for (const e of expenses) delete next[e.id];
        return next;
      });
    } else {
      setSelectedMap((prev) => {
        const next = { ...prev };
        for (const e of expenses) next[e.id] = e;
        return next;
      });
    }
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
    setSelectedMap({});
  }, [filterType, filterVehicles, filterCategories, filterPersons, filterPaidByPersons, filterPaidByEntities, filterPaymentSources, filterDateFrom, filterDateTo, filterMonth, searchQuery]);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      resetExpenseImageState();
      setEditingId(null);
      setForm(emptyForm);
      setDialogOpen(true);
      router.replace('/expenses', { scroll: false });
    }
  }, [searchParams, router]);

  function clearPendingImages() {
    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPendingImageFiles([]);
    setImagePreviewUrls([]);
  }

  function resetExpenseImageState() {
    clearPendingImages();
    setExpenseImageUrls([]);
    setRemovedImageUrls([]);
  }

  function expenseImageList(exp: Expense): string[] {
    return normalizeImageUrls(exp.image_urls, exp.image_url);
  }

  function openImageGallery(urls: string[], startIndex = 0) {
    if (urls.length === 0) return;
    setImageGallery(urls);
    setImageGalleryIndex(Math.min(Math.max(startIndex, 0), urls.length - 1));
  }

  function handleAddImageFiles(files: File[]) {
    const room = MAX_ENTITY_IMAGES - (expenseImageUrls.length + pendingImageFiles.length);
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_ENTITY_IMAGES} images`);
      return;
    }
    const accepted: File[] = [];
    for (const file of files.slice(0, room)) {
      try {
        validateExpenseImageFile(file);
        accepted.push(file);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Invalid image');
      }
    }
    if (accepted.length === 0) return;
    setPendingImageFiles((prev) => [...prev, ...accepted]);
    setImagePreviewUrls((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  }

  function removeExistingExpenseImage(index: number) {
    setExpenseImageUrls((prev) => {
      const url = prev[index];
      if (url) setRemovedImageUrls((r) => (r.includes(url) ? r : [...r, url]));
      return prev.filter((_, i) => i !== index);
    });
  }

  function removePendingExpenseImage(index: number) {
    setPendingImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviewUrls((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function closeExpenseDialog() {
    resetExpenseImageState();
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(false);
  }

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
      image_urls: expenseImageUrls,
      image_url: expenseImageUrls[0] || null,
    };
    setSaving(true);
    try {
      if (editingId) {
        let nextUrls = [...expenseImageUrls];
        if (pendingImageFiles.length > 0) {
          const uploaded = await uploadExpenseImageMany(editingId, pendingImageFiles);
          nextUrls = [...nextUrls, ...uploaded];
        }
        if (removedImageUrls.length > 0) {
          await removeExpenseImageMany(removedImageUrls);
        }
        const { error } = await supabase.from('expenses').update({
          ...payload,
          image_urls: nextUrls,
          image_url: nextUrls[0] || null,
        }).eq('id', editingId);
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

        if (pendingImageFiles.length > 0 && inserted?.id) {
          try {
            const uploaded = await uploadExpenseImageMany(inserted.id, pendingImageFiles);
            const { error: imgErr } = await supabase.from('expenses').update({
              image_urls: uploaded,
              image_url: uploaded[0] || null,
            }).eq('id', inserted.id);
            if (imgErr) toast.error('Expense saved but image upload failed: ' + imgErr.message);
          } catch (imgErr) {
            toast.error(imgErr instanceof Error ? imgErr.message : 'Expense saved but image upload failed');
          }
        }

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
      closeExpenseDialog();
      fetchExpenses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(exp: Expense) {
    resetExpenseImageState();
    const urls = expenseImageList(exp);
    setExpenseImageUrls(urls);
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
    const exp = expenses.find((e) => e.id === id);
    const urls = exp ? expenseImageList(exp) : [];
    if (urls.length > 0) {
      await removeExpenseImageMany(urls);
    }
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
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || loading}
              onClick={() => handleExport('csv', 'filtered')}
              title="Export all filtered expenses"
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || loading}
              onClick={() => handleExport('pdf', 'filtered')}
              title="Export all filtered expenses"
            >
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </>
        }
      />

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 sm:px-4">
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} selected · {formatCurrency(selectedTotal)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={exporting}
            onClick={() => handleExport('csv', 'selected')}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={exporting}
            onClick={() => handleExport('pdf', 'selected')}
          >
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedMap({})}>
            Clear
          </Button>
        </div>
      )}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeExpenseDialog(); else setDialogOpen(true); }}>
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
              <div>
                <MultiImageField
                  label="Receipt images (optional)"
                  existingUrls={expenseImageUrls}
                  pendingPreviews={imagePreviewUrls}
                  onAddFiles={handleAddImageFiles}
                  onRemoveExisting={removeExistingExpenseImage}
                  onRemovePending={removePendingExpenseImage}
                  onView={(url) => {
                    const all = [...expenseImageUrls, ...imagePreviewUrls];
                    openImageGallery(all, all.indexOf(url));
                  }}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : `${editingId ? 'Update' : 'Add'} Expense`}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={imageGallery.length > 0}
          onOpenChange={(open) => { if (!open) { setImageGallery([]); setImageGalleryIndex(0); } }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[calc(100%-1.5rem)]">
            <DialogHeader>
              <DialogTitle>
                Expense receipt{imageGallery.length > 1 ? ` (${imageGalleryIndex + 1}/${imageGallery.length})` : ''}
              </DialogTitle>
            </DialogHeader>
            {imageGallery[imageGalleryIndex] && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageGallery[imageGalleryIndex]}
                  alt="Expense receipt"
                  className="w-full max-h-[70vh] object-contain rounded-md border bg-gray-50"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {imageGallery.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={imageGalleryIndex <= 0}
                        onClick={() => setImageGalleryIndex((i) => i - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={imageGalleryIndex >= imageGallery.length - 1}
                        onClick={() => setImageGalleryIndex((i) => i + 1)}
                      >
                        Next
                      </Button>
                    </>
                  )}
                  <a
                    href={imageGallery[imageGalleryIndex]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Open full image in new tab
                  </a>
                </div>
              </>
            )}
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
            const selected = !!selectedMap[exp.id];
            return (
              <Card key={exp.id} className={selected ? 'border-blue-300 bg-blue-50/30' : undefined}>
                <CardContent className="p-0">
                  <div className="flex items-start gap-2 p-4 pb-0">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-300 shrink-0"
                      checked={selected}
                      onChange={() => toggleSelect(exp)}
                      aria-label={`Select expense ${exp.id}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left space-y-2 pb-4"
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
                  </div>

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
                        {expenseImageList(exp).length > 0 && (
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase text-gray-500">
                              Images{expenseImageList(exp).length > 1 ? ` (${expenseImageList(exp).length})` : ''}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {expenseImageList(exp).map((url, idx) => (
                                <button
                                  key={`${exp.id}-img-${idx}`}
                                  type="button"
                                  className="block max-w-[120px] overflow-hidden rounded border"
                                  onClick={(e) => { e.stopPropagation(); openImageGallery(expenseImageList(exp), idx); }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt="Expense receipt" className="max-h-28 w-full object-contain bg-gray-50" />
                                </button>
                              ))}
                            </div>
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
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      disabled={expenses.length === 0}
                      aria-label="Select all on page"
                      className="rounded border-gray-300"
                    />
                  </TableHead>
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
                  <TableHead>Image</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-8 text-gray-500">No expenses found</TableCell></TableRow>
                ) : (
                  expenses.map((exp) => (
                    <TableRow key={exp.id} className={selectedMap[exp.id] ? 'bg-blue-50/40' : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={!!selectedMap[exp.id]}
                          onChange={() => toggleSelect(exp)}
                          aria-label={`Select expense ${exp.id}`}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
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
                        {expenseImageList(exp).length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 relative"
                            title={expenseImageList(exp).length > 1 ? `View images (${expenseImageList(exp).length})` : 'View image'}
                            onClick={() => openImageGallery(expenseImageList(exp))}
                          >
                            <ImageIcon className="h-4 w-4 text-blue-600" />
                            {expenseImageList(exp).length > 1 && (
                              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-blue-600 text-white text-[9px] leading-3.5 text-center">
                                {expenseImageList(exp).length}
                              </span>
                            )}
                          </Button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
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
