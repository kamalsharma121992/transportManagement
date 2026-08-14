'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase, Trip, TRIP_PAYMENT_STATUSES, type TripPaymentStatus } from '@/lib/supabase';
import { formatCurrency, formatDate, getMonthFilterOptions, getMonthDateRange, FILTER_SELECT_CLASS } from '@/lib/format';
import {
  parseTripPdf,
  recalcTripRow,
  type ParsedTripRow,
  type TripFormData,
} from '@/lib/parse-trip-pdf';
import {
  TRIP_PAYMENT_DISPLAY_FILTERS,
  getTripPaymentDisplayStatus,
  isFullPendingAmounts,
  isTripPaymentDueSoon,
  isTripPaymentOverdue,
  isTripUnpaid,
  normalizeTripPaymentStatus,
} from '@/lib/trip-payments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Upload, FileText, Loader2, X, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/pagination-controls';
import { PageHeader } from '@/components/page-header';
import { ActiveFiltersBar } from '@/components/active-filters-bar';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { applyInFilter, formatMultiFilterLabel } from '@/lib/filter-helpers';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';
import { buildTextSearchFilter, TRIP_SEARCH_COLUMNS } from '@/lib/search';
import { applySupabaseSort } from '@/lib/sort';
import { useTableSort } from '@/hooks/use-table-sort';
import { SortableTableHead } from '@/components/sortable-table-head';
import { cn } from '@/lib/utils';

const emptyTrip: TripFormData = {
  date: new Date().toISOString().split('T')[0],
  vehicle_number: '',
  route_name: '',
  driver_name: '',
  weight_tons: 0,
  distance_km: 0,
  rate_per_ton: 0,
  total_revenue: 0,
  commission: 0,
  advance_paid: 0,
  balance_due: 0,
  payment_status: 'Fully Paid',
  payment_expected_date: '',
  notes: '',
};

const SELECT_CLASS = 'w-full min-w-[120px] border rounded-md px-2 py-1.5 text-sm bg-white';

function calcNetRevenue(weight: number, rate: number, commission: number) {
  return Math.max(Math.round((weight * rate - (commission || 0)) * 100) / 100, 0);
}

function withFullPendingAmounts<T extends { advance_paid: number; balance_due: number; total_revenue: number }>(
  form: T,
  fullPending: boolean,
): T {
  if (!fullPending) return form;
  return { ...form, advance_paid: 0, balance_due: form.total_revenue };
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [routes, setRoutes] = useState<{ route_name: string; origin: string; destination: string; distance_km: number; standard_rate_per_ton: number; commission: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTrip);
  const [fullPending, setFullPending] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [parsedTrips, setParsedTrips] = useState<ParsedTripRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterVehicles, setFilterVehicles] = useState<string[]>([]);
  const [filterRoutes, setFilterRoutes] = useState<string[]>([]);
  const [filterDrivers, setFilterDrivers] = useState<string[]>([]);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput);
  const { sortColumn, sortDirection, toggleSort } = useTableSort('date', 'desc');
  const [summary, setSummary] = useState({ count: 0, revenue: 0, weight: 0, pendingRevenue: 0, paidRevenue: 0 });

  const hasActiveFilters = filterMonth !== currentMonth || !!filterDateFrom || !!filterDateTo || filterVehicles.length > 0 || filterRoutes.length > 0 || filterDrivers.length > 0 || !!filterPaymentStatus || !!searchQuery;

  function clearFilters() {
    setFilterMonth(currentMonth);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterVehicles([]);
    setFilterRoutes([]);
    setFilterDrivers([]);
    setFilterPaymentStatus('');
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
  if (filterVehicles.length > 0) {
    const label = formatMultiFilterLabel('Vehicle', filterVehicles);
    if (label) activeFilterLabels.push(label);
  }
  if (filterRoutes.length > 0) {
    const label = formatMultiFilterLabel('Route', filterRoutes);
    if (label) activeFilterLabels.push(label);
  }
  if (filterDrivers.length > 0) {
    const label = formatMultiFilterLabel('Driver', filterDrivers);
    if (label) activeFilterLabels.push(label);
  }
  if (filterPaymentStatus) activeFilterLabels.push('Payment: ' + filterPaymentStatus);
  if (searchQuery) activeFilterLabels.push('Search: ' + searchQuery);

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    totalItems: totalTrips,
    setTotalItems: setTotalTrips,
    totalPages,
  } = useServerPagination([
    filterMonth, filterDateFrom, filterDateTo, filterVehicles, filterRoutes, filterDrivers, filterPaymentStatus, searchQuery,
    sortColumn, sortDirection,
  ]);

  function applyTripFilters<Q>(query: Q): Q {
    let q = query as {
      eq: (col: string, val: string | number) => typeof q;
      in: (col: string, vals: string[]) => typeof q;
      gt: (col: string, val: number) => typeof q;
      gte: (col: string, val: string) => typeof q;
      lte: (col: string, val: string) => typeof q;
      or: (filter: string) => typeof q;
    };
    q = applyInFilter(q, 'vehicle_number', filterVehicles);
    q = applyInFilter(q, 'route_name', filterRoutes);
    q = applyInFilter(q, 'driver_name', filterDrivers);
    if (filterPaymentStatus === 'Fully Paid') {
      q = q.eq('payment_status', 'Fully Paid');
    } else if (filterPaymentStatus === 'Pending') {
      q = q.eq('payment_status', 'Pending').eq('advance_paid', 0);
    } else if (filterPaymentStatus === 'Partial Pending') {
      q = q.eq('payment_status', 'Pending').gt('advance_paid', 0);
    }
    if (filterMonth) {
      const { from, to } = getMonthDateRange(filterMonth);
      q = q.gte('date', from).lte('date', to);
    } else {
      if (filterDateFrom) q = q.gte('date', filterDateFrom);
      if (filterDateTo) q = q.lte('date', filterDateTo);
    }
    const searchFilter = buildTextSearchFilter([...TRIP_SEARCH_COLUMNS], searchQuery);
    if (searchFilter) q = q.or(searchFilter);
    return q as Q;
  }

  async function fetchTrips() {
    setLoading(true);
    const { from, to } = getSupabaseRange(page, pageSize);

    let listQuery = applySupabaseSort(
      applyTripFilters(
        supabase.from('trips').select('*', { count: 'exact' }),
      ),
      sortColumn,
      sortDirection,
    );
    const { data, count, error } = await listQuery.range(from, to);

    const summaryQuery = applyTripFilters(supabase.from('trips').select('total_revenue, weight_tons, payment_status, advance_paid, balance_due'));
    const { data: summaryRows, error: summaryError } = await summaryQuery;

    if (error) { toast.error('Failed to load trips: ' + error.message); setLoading(false); return; }
    if (summaryError) { toast.error('Failed to load trip summary: ' + summaryError.message); }

    const rows = (summaryRows || []) as {
      total_revenue: number;
      weight_tons: number;
      payment_status: string;
      advance_paid: number;
      balance_due: number;
    }[];
    setTrips(data || []);
    setTotalTrips(count ?? 0);
    setSummary({
      count: count ?? 0,
      revenue: rows.reduce((s, t) => s + Number(t.total_revenue), 0),
      weight: rows.reduce((s, t) => s + Number(t.weight_tons), 0),
      pendingRevenue: rows.reduce((s, t) => (
        isTripUnpaid(t.payment_status) ? s + Number(t.balance_due || 0) : s
      ), 0),
      paidRevenue: rows.reduce((s, t) => (
        t.payment_status === 'Fully Paid'
          ? s + Number(t.total_revenue)
          : s + Number(t.advance_paid || 0)
      ), 0),
    });
    setLoading(false);
  }

  useEffect(() => {
    setExpandedId(null);
    fetchTrips();
  }, [page, pageSize, filterMonth, filterDateFrom, filterDateTo, filterVehicles, filterRoutes, filterDrivers, filterPaymentStatus, searchQuery, sortColumn, sortDirection]);

  useEffect(() => {
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: { vehicle_number: string }) => v.vehicle_number));
    });
    supabase.from('drivers').select('name').eq('status', 'active').order('name').then(({ data, error }) => {
      if (error) {
        supabase.from('drivers').select('name').order('name').then(({ data: all }) => {
          setDrivers((all || []).map((d: { name: string }) => d.name));
        });
        return;
      }
      setDrivers((data || []).map((d: { name: string }) => d.name));
    });
    supabase.from('routes').select('route_name, origin, destination, distance_km, standard_rate_per_ton, commission').then(({ data, error }) => {
      if (error) {
        supabase.from('routes').select('route_name, origin, destination, distance_km, standard_rate_per_ton').then(({ data: fallback }) => {
          setRoutes((fallback || []).map((r) => ({ ...r, commission: 0 })));
        });
        return;
      }
      setRoutes((data || []).map((r) => ({ ...r, commission: Number(r.commission) || 0 })));
    });
  }, []);

  function resetFormDialog() {
    setEditingId(null);
    setForm(emptyTrip);
    setFullPending(false);
    setDialogOpen(false);
  }

  function resetPdfModal() {
    setPdfFile(null);
    setParsedTrips([]);
    setPdfModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openNewTripDialog() {
    resetFormDialog();
    setDialogOpen(true);
  }

  function openPdfUpload() {
    resetPdfModal();
    fileInputRef.current?.click();
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF must be under 10 MB');
      e.target.value = '';
      return;
    }

    setPdfParsing(true);
    setPdfFile(file);
    setParsedTrips([]);
    setPdfModalOpen(true);

    try {
      const result = await parseTripPdf(file, { vehicles, drivers, routes });

      if (result.trips.length === 0) {
        setParsedTrips([{
          ...emptyTrip,
          rowId: 'row-1',
          complete: false,
          missingFields: ['Date', 'Vehicle', 'Route', 'Driver', 'Weight', 'Distance', 'Rate/Ton', 'Revenue'],
        }]);
        toast.warning('No trips detected in PDF. Fill the row manually.');
      } else {
        setParsedTrips(result.trips);
        const complete = result.trips.filter((t) => t.complete).length;
        toast.success(`Found ${result.trips.length} trip(s). ${complete} ready to import.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not read PDF. Check the file and try again.');
      setParsedTrips([{
        ...emptyTrip,
        rowId: 'row-1',
        complete: false,
        missingFields: ['Date', 'Vehicle', 'Route', 'Driver', 'Weight', 'Distance', 'Rate/Ton', 'Revenue'],
      }]);
    } finally {
      setPdfParsing(false);
    }
  }

  function updateParsedRow(rowId: string, patch: Partial<TripFormData>) {
    setParsedTrips((rows) =>
      rows.map((row) => {
        if (row.rowId !== rowId) return row;
        let nextPatch = patch;
        if (patch.route_name !== undefined) {
          const route = routes.find((r) => r.route_name === patch.route_name);
          if (route) {
            nextPatch = {
              ...patch,
              distance_km: Number(route.distance_km),
              rate_per_ton: Number(route.standard_rate_per_ton),
              commission: Number(route.commission) || 0,
            };
          }
        }
        if (patch.weight_tons !== undefined || patch.rate_per_ton !== undefined || patch.commission !== undefined || patch.route_name !== undefined) {
          const weight = nextPatch.weight_tons ?? row.weight_tons;
          const rate = nextPatch.rate_per_ton ?? row.rate_per_ton;
          const commission = nextPatch.commission ?? row.commission;
          nextPatch = {
            ...nextPatch,
            total_revenue: calcNetRevenue(weight, rate, commission || 0),
          };
        }
        const updated = recalcTripRow({ ...row, ...nextPatch }, { vehicles, drivers, routes });
        const missingFields = [
          !updated.date && 'Date',
          !updated.vehicle_number && 'Vehicle',
          !updated.route_name && 'Route',
          !updated.driver_name && 'Driver',
          !updated.weight_tons && 'Weight',
          !updated.distance_km && 'Distance',
          !updated.rate_per_ton && 'Rate/Ton',
          !updated.total_revenue && 'Revenue',
        ].filter(Boolean) as string[];
        return {
          ...updated,
          rowId: row.rowId,
          complete: missingFields.length === 0,
          missingFields,
        };
      }),
    );
  }

  function removeParsedRow(rowId: string) {
    setParsedTrips((rows) => rows.filter((r) => r.rowId !== rowId));
  }

  function addEmptyParsedRow() {
    setParsedTrips((rows) => [
      ...rows,
      {
        ...emptyTrip,
        rowId: `row-${Date.now()}`,
        complete: false,
        missingFields: ['Date', 'Vehicle', 'Route', 'Driver', 'Weight', 'Distance', 'Rate/Ton', 'Revenue'],
      },
    ]);
  }

  async function handleImportParsedTrips() {
    const ready = parsedTrips.filter((r) => r.complete);
    if (ready.length === 0) {
      toast.error('Complete required fields before importing');
      return;
    }

    setPdfImporting(true);
    const payload = ready.map(({ rowId, complete, missingFields, ...trip }) => ({
      ...trip,
      payment_expected_date: trip.payment_expected_date || null,
      notes: trip.notes || null,
    }));
    const { error } = await supabase.from('trips').insert(payload);
    setPdfImporting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${ready.length} trip(s) imported`);
    resetPdfModal();
    fetchTrips();
  }

  function handleRouteChange(routeName: string) {
    const route = routes.find((r) => r.route_name === routeName);
    if (!route) {
      setForm((f) => ({ ...f, route_name: routeName }));
      return;
    }
    const rate = Number(route.standard_rate_per_ton) || 0;
    const commission = Number(route.commission) || 0;
    setForm((f) => withFullPendingAmounts({
      ...f,
      route_name: routeName,
      distance_km: Number(route.distance_km) || f.distance_km,
      rate_per_ton: rate,
      commission,
      total_revenue: calcNetRevenue(f.weight_tons, rate, commission),
    }, fullPending && f.payment_status === 'Pending'));
  }

  function recalcRevenue(weight: number, rate: number, commission?: number) {
    setForm((f) => {
      const nextCommission = commission ?? f.commission;
      return withFullPendingAmounts({
        ...f,
        weight_tons: weight,
        rate_per_ton: rate,
        commission: nextCommission,
        total_revenue: calcNetRevenue(weight, rate, nextCommission),
      }, fullPending && f.payment_status === 'Pending');
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      payment_expected_date:
        form.payment_status === 'Pending' ? form.payment_expected_date || null : null,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from('trips').update(payload).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Trip updated');
    } else {
      const { error } = await supabase.from('trips').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Trip added');
    }
    resetFormDialog();
    fetchTrips();
  }

  function startEdit(trip: Trip) {
    setEditingId(trip.id);
    const next = {
      date: trip.date,
      vehicle_number: trip.vehicle_number,
      route_name: trip.route_name,
      driver_name: trip.driver_name,
      weight_tons: Number(trip.weight_tons),
      distance_km: Number(trip.distance_km),
      rate_per_ton: Number(trip.rate_per_ton),
      total_revenue: Number(trip.total_revenue),
      commission: Number(trip.commission) || 0,
      advance_paid: Number(trip.advance_paid),
      balance_due: Number(trip.balance_due),
      payment_status: normalizeTripPaymentStatus(trip.payment_status),
      payment_expected_date: trip.payment_expected_date || '',
      notes: trip.notes || '',
    };
    setForm(next);
    setFullPending(isFullPendingAmounts(next));
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this trip?')) return;
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Trip deleted');
    fetchTrips();
  }

  const readyCount = parsedTrips.filter((r) => r.complete).length;

  function renderPaymentBadge(trip: Trip) {
    if (trip.payment_status === 'Fully Paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="h-3 w-3" /> Fully Paid
        </span>
      );
    }
    const overdue = isTripPaymentOverdue(trip);
    if (overdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-600 text-white">
          <AlertTriangle className="h-3 w-3" /> Overdue
        </span>
      );
    }
    const display = getTripPaymentDisplayStatus(trip);
    if (display === 'Partial Pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-800">
          <Clock className="h-3 w-3" /> Partial Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  }

  function paymentHighlightClass(trip: Trip) {
    const overdue = isTripPaymentOverdue(trip);
    const dueSoon = isTripPaymentDueSoon(trip);
    const display = getTripPaymentDisplayStatus(trip);
    return cn(
      overdue && 'border-red-400 bg-red-50',
      dueSoon && display === 'Partial Pending' && 'border-orange-400 bg-orange-50',
      dueSoon && display === 'Pending' && 'border-amber-400 bg-amber-50',
    );
  }

  function paymentRowClass(trip: Trip) {
    const overdue = isTripPaymentOverdue(trip);
    const dueSoon = isTripPaymentDueSoon(trip);
    const display = getTripPaymentDisplayStatus(trip);
    return cn(
      overdue && 'bg-red-100 border-l-4 border-l-red-600 hover:bg-red-100/90',
      dueSoon && display === 'Partial Pending' && 'bg-orange-100 border-l-4 border-l-orange-500 hover:bg-orange-100/90',
      dueSoon && display === 'Pending' && 'bg-amber-100 border-l-4 border-l-amber-500 hover:bg-amber-100/90',
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trip Log"
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: 'Search vehicle, route, driver, notes...',
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        clearFiltersLabel="Reset filters"
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
            <Button variant="outline" disabled={pdfParsing} onClick={openPdfUpload}>
              {pdfParsing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Upload PDF</>
              )}
            </Button>
            <Button onClick={openNewTripDialog}><Plus className="h-4 w-4 mr-2" /> Add Trip</Button>
          </>
        }
      />

      <ActiveFiltersBar
        labels={activeFilterLabels}
        onClear={hasActiveFilters ? clearFilters : undefined}
        clearLabel="Reset filters"
      />

      {/* Summary: collapsible revenue-only on mobile; full cards on desktop */}
      <div className="md:hidden space-y-2">
        <button
          type="button"
          onClick={() => setShowSummary((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-left shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Revenue</p>
            <p className="text-sm font-semibold text-green-700 truncate">
              {formatCurrency(summary.revenue)}
              <span className="font-normal text-gray-400"> · {summary.count} trips</span>
            </p>
          </div>
          {showSummary ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />}
        </button>
        {showSummary && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-amber-600">Pending</p>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(summary.pendingRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4">
                <p className="text-xs text-green-600">Fully Paid</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(summary.paidRevenue)}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="hidden md:grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500">Trips</p>
            <p className="text-xl font-bold text-gray-900">{summary.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary.revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-amber-600">Pending</p>
            <p className="text-xl font-bold text-amber-700">{formatCurrency(summary.pendingRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-green-600">Fully Paid</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(summary.paidRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
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
                  label="Vehicle"
                  options={vehicles}
                  selected={filterVehicles}
                  onChange={setFilterVehicles}
                  placeholder="All vehicles"
                  searchPlaceholder="Search vehicle..."
                />
                <MultiSelectFilter
                  label="Route"
                  options={routes.map((r) => r.route_name)}
                  selected={filterRoutes}
                  onChange={setFilterRoutes}
                  placeholder="All routes"
                  searchPlaceholder="Search route..."
                />
                <MultiSelectFilter
                  label="Driver"
                  options={drivers}
                  selected={filterDrivers}
                  onChange={setFilterDrivers}
                  placeholder="All drivers"
                  searchPlaceholder="Search driver..."
                />
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Payment</label>
                  <select
                    className={FILTER_SELECT_CLASS}
                    value={filterPaymentStatus}
                    onChange={(e) => setFilterPaymentStatus(e.target.value)}
                  >
                    <option value="">All</option>
                    {TRIP_PAYMENT_DISPLAY_FILTERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* PDF import preview modal */}
      <Dialog open={pdfModalOpen} onOpenChange={(open) => { if (!open) resetPdfModal(); else setPdfModalOpen(true); }}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Trips from PDF</DialogTitle>
          </DialogHeader>

          {pdfFile && (
            <div className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
              <FileText className="h-4 w-4" />
              <span className="truncate">{pdfFile.name}</span>
              {pdfParsing && <Loader2 className="h-4 w-4 animate-spin" />}
              {!pdfParsing && parsedTrips.length > 0 && (
                <Badge variant="outline">{parsedTrips.length} row(s) · {readyCount} ready</Badge>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500 shrink-0">
            Review extracted rows below. Empty cells were not found in the PDF — fill them manually before importing.
          </p>

          <div className="flex-1 overflow-auto border rounded-lg">
            {pdfParsing ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Reading PDF...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[130px]">Date</TableHead>
                    <TableHead className="min-w-[130px]">Vehicle</TableHead>
                    <TableHead className="min-w-[140px]">Route</TableHead>
                    <TableHead className="min-w-[130px]">Driver</TableHead>
                    <TableHead className="min-w-[90px]">Weight</TableHead>
                    <TableHead className="min-w-[90px]">Dist.</TableHead>
                    <TableHead className="min-w-[90px]">Rate</TableHead>
                    <TableHead className="min-w-[100px]">Revenue</TableHead>
                    <TableHead className="min-w-[90px]">Advance</TableHead>
                    <TableHead className="min-w-[90px]">Balance</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTrips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                        No rows yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    parsedTrips.map((row) => (
                      <TableRow key={row.rowId} className={row.complete ? '' : 'bg-amber-50/50'}>
                        <TableCell className="p-2">
                          <Input
                            type="date"
                            className="h-8 min-w-[130px]"
                            value={row.date}
                            onChange={(e) => updateParsedRow(row.rowId, { date: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <select
                            className={SELECT_CLASS}
                            value={row.vehicle_number}
                            onChange={(e) => updateParsedRow(row.rowId, { vehicle_number: e.target.value })}
                          >
                            <option value="">—</option>
                            {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                            {row.vehicle_number && !vehicles.includes(row.vehicle_number) && (
                              <option value={row.vehicle_number}>{row.vehicle_number}</option>
                            )}
                          </select>
                        </TableCell>
                        <TableCell className="p-2">
                          <select
                            className={SELECT_CLASS}
                            value={row.route_name}
                            onChange={(e) => updateParsedRow(row.rowId, { route_name: e.target.value })}
                          >
                            <option value="">—</option>
                            {routes.map((r) => <option key={r.route_name} value={r.route_name}>{r.route_name}</option>)}
                          </select>
                        </TableCell>
                        <TableCell className="p-2">
                          <select
                            className={SELECT_CLASS}
                            value={row.driver_name}
                            onChange={(e) => updateParsedRow(row.rowId, { driver_name: e.target.value })}
                          >
                            <option value="">—</option>
                            {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
                            {row.driver_name && !drivers.includes(row.driver_name) && (
                              <option value={row.driver_name}>{row.driver_name}</option>
                            )}
                          </select>
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-24"
                            value={row.weight_tons || ''}
                            placeholder="—"
                            onChange={(e) => updateParsedRow(row.rowId, { weight_tons: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={row.distance_km || ''}
                            placeholder="—"
                            onChange={(e) => updateParsedRow(row.rowId, { distance_km: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-20"
                            value={row.rate_per_ton || ''}
                            placeholder="—"
                            onChange={(e) => updateParsedRow(row.rowId, { rate_per_ton: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-24"
                            value={row.total_revenue || ''}
                            placeholder="—"
                            onChange={(e) => updateParsedRow(row.rowId, { total_revenue: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-20"
                            value={row.advance_paid || ''}
                            placeholder="—"
                            onChange={(e) => updateParsedRow(row.rowId, { advance_paid: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-20"
                            value={row.balance_due || ''}
                            placeholder="—"
                            onChange={(e) => updateParsedRow(row.rowId, { balance_due: Number(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Button variant="ghost" size="icon" onClick={() => removeParsedRow(row.rowId)}>
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 shrink-0">
            <Button type="button" variant="outline" onClick={addEmptyParsedRow} disabled={pdfParsing}>
              <Plus className="h-4 w-4 mr-1" /> Add Row
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={resetPdfModal}>Cancel</Button>
              <Button
                type="button"
                disabled={pdfParsing || pdfImporting || readyCount === 0}
                onClick={handleImportParsedTrips}
              >
                {pdfImporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                ) : (
                  <>Import {readyCount} Trip{readyCount !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single trip add/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetFormDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[calc(100%-1.5rem)]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Trip' : 'New Trip'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div>
                <Label>Vehicle</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} required>
                  <option value="">Select</option>
                  {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label>Route</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.route_name} onChange={(e) => handleRouteChange(e.target.value)} required>
                  <option value="">Select</option>
                  {routes.map((r) => <option key={r.route_name} value={r.route_name}>{r.route_name}</option>)}
                </select>
              </div>
              <div>
                <Label>Driver</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} required>
                  <option value="">Select</option>
                  {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <Label>Weight (Tons)</Label>
                <Input type="number" step="0.01" value={form.weight_tons || ''} onChange={(e) => recalcRevenue(Number(e.target.value), form.rate_per_ton)} required />
              </div>
              <div>
                <Label>Distance (KM)</Label>
                <Input type="number" value={form.distance_km || ''} onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })} required />
              </div>
              <div>
                <Label>Rate/Ton</Label>
                <Input type="number" step="0.01" value={form.rate_per_ton || ''} onChange={(e) => recalcRevenue(form.weight_tons, Number(e.target.value))} required />
              </div>
              <div>
                <Label>Commission ({'\u20B9'})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.commission}
                  onChange={(e) => {
                    const commission = e.target.value === '' ? 0 : Number(e.target.value);
                    recalcRevenue(form.weight_tons, form.rate_per_ton, commission);
                  }}
                />
                <p className="text-[10px] text-gray-400 mt-1">Auto from route — editable</p>
              </div>
              <div>
                <Label>Total Revenue</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.total_revenue || ''}
                  onChange={(e) => {
                    const total_revenue = Number(e.target.value);
                    setForm((f) => withFullPendingAmounts({ ...f, total_revenue }, fullPending && f.payment_status === 'Pending'));
                  }}
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1">weight × rate − commission</p>
              </div>
              <div>
                <Label>Advance Paid</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.advance_paid || ''}
                  onChange={(e) => {
                    const advance_paid = Number(e.target.value);
                    setForm((f) => ({ ...f, advance_paid }));
                    if (fullPending && advance_paid !== 0) setFullPending(false);
                  }}
                />
              </div>
              <div>
                <Label>Balance Due</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.balance_due || ''}
                  onChange={(e) => {
                    const balance_due = Number(e.target.value);
                    setForm((f) => ({ ...f, balance_due }));
                    if (fullPending && balance_due !== form.total_revenue) setFullPending(false);
                  }}
                />
              </div>
              <div>
                <Label>Payment</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.payment_status}
                  onChange={(e) => {
                    const payment_status = e.target.value as TripPaymentStatus;
                    const nextFullPending = payment_status === 'Pending';
                    setFullPending(nextFullPending);
                    setForm((f) => {
                      if (payment_status === 'Fully Paid') {
                        return { ...f, payment_status, balance_due: 0, payment_expected_date: '' };
                      }
                      return withFullPendingAmounts({ ...f, payment_status }, nextFullPending);
                    });
                  }}
                >
                  {TRIP_PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {form.payment_status === 'Pending' && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      id="full-pending"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={fullPending}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFullPending(checked);
                        if (checked) {
                          setForm((f) => withFullPendingAmounts(f, true));
                        }
                      }}
                    />
                    <Label htmlFor="full-pending" className="font-normal">Full amount pending</Label>
                  </div>
                  <div>
                    <Label>Expected payment date</Label>
                    <Input
                      type="date"
                      value={form.payment_expected_date}
                      onChange={(e) => setForm({ ...form, payment_expected_date: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Optional reminder for remaining balance</p>
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Trip</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">Loading...</CardContent>
          </Card>
        ) : trips.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">No trips found</CardContent>
          </Card>
        ) : (
          trips.map((trip) => {
            const expanded = expandedId === trip.id;
            const overdue = isTripPaymentOverdue(trip);
            const pending = isTripUnpaid(trip.payment_status);
            return (
              <Card
                key={trip.id}
                className={paymentHighlightClass(trip)}
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="w-full text-left p-4 space-y-2"
                    onClick={() => setExpandedId(expanded ? null : trip.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base truncate">
                          <span className="font-normal text-gray-500">Vehicle: </span>
                          <span className="font-bold text-gray-900">{trip.vehicle_number}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(trip.date)}</p>
                        <p className="mt-1 text-sm text-gray-700 truncate">{trip.route_name}</p>
                        <p className="text-sm text-gray-600 truncate">{trip.driver_name}</p>
                        {trip.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{trip.notes}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <p className="text-base font-bold text-green-600">{formatCurrency(Number(trip.total_revenue))}</p>
                        {renderPaymentBadge(trip)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{expanded ? 'Hide details' : 'Tap for details'}</span>
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t px-4 py-3 space-y-2 bg-gray-50/80">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Weight</p>
                          <p className="font-medium text-gray-800">{Number(trip.weight_tons).toFixed(2)} T</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Rate / ton</p>
                          <p className="font-medium text-gray-800">{formatCurrency(Number(trip.rate_per_ton))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Advance</p>
                          <p className="font-medium text-gray-800">{formatCurrency(Number(trip.advance_paid))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Balance due</p>
                          <p className="font-medium text-gray-800">{formatCurrency(Number(trip.balance_due))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Commission</p>
                          <p className="font-medium text-gray-800">{formatCurrency(Number(trip.commission || 0))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-gray-500">Distance</p>
                          <p className="font-medium text-gray-800">{Number(trip.distance_km || 0)} km</p>
                        </div>
                        {pending && trip.payment_expected_date && (
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase text-gray-500">Expected payment</p>
                            <p className={cn('font-medium', overdue ? 'text-red-700' : 'text-gray-800')}>
                              {formatDate(trip.payment_expected_date)}
                            </p>
                          </div>
                        )}
                        {trip.notes && (
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase text-gray-500">Notes</p>
                            <p className="font-medium text-gray-800 whitespace-pre-wrap">{trip.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={(e) => { e.stopPropagation(); startEdit(trip); }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-600 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); handleDelete(trip.id); }}
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
              totalItems={totalTrips}
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
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Rate/Ton</TableHead>
                  <SortableTableHead label="Total Revenue" column="total_revenue" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} className="text-right" />
                  <TableHead>Payment</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">No trips found</TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => {
                    const overdue = isTripPaymentOverdue(trip);
                    const pending = isTripUnpaid(trip.payment_status);
                    return (
                    <TableRow
                      key={trip.id}
                      className={paymentRowClass(trip)}
                    >
                      <TableCell>{formatDate(trip.date)}</TableCell>
                      <TableCell><Badge variant="outline">{trip.vehicle_number}</Badge></TableCell>
                      <TableCell>{trip.route_name}</TableCell>
                      <TableCell>{trip.driver_name}</TableCell>
                      <TableCell className="text-right">{Number(trip.weight_tons).toFixed(2)} T</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(trip.rate_per_ton))}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatCurrency(Number(trip.total_revenue))}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {renderPaymentBadge(trip)}
                          {pending && trip.payment_expected_date && (
                            <p className={cn('text-[10px]', overdue ? 'text-red-700 font-medium' : 'text-gray-500')}>
                              Due {formatDate(trip.payment_expected_date)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px] text-sm text-gray-600 truncate" title={trip.notes || undefined}>
                        {trip.notes || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(trip)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(trip.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={totalTrips}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
