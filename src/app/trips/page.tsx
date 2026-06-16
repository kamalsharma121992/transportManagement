'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase, Trip } from '@/lib/supabase';
import { formatCurrency, formatDate, getMonthFilterOptions, FILTER_SELECT_CLASS } from '@/lib/format';
import {
  parseTripPdf,
  recalcTripRow,
  type ParsedTripRow,
  type TripFormData,
} from '@/lib/parse-trip-pdf';
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
import { Plus, Pencil, Trash2, Upload, FileText, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/pagination-controls';
import { PageHeader } from '@/components/page-header';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useServerPagination } from '@/hooks/use-server-pagination';
import { getSupabaseRange } from '@/lib/pagination';
import { buildTextSearchFilter, TRIP_SEARCH_COLUMNS } from '@/lib/search';

const emptyTrip: TripFormData = {
  date: new Date().toISOString().split('T')[0],
  vehicle_number: '',
  route_name: '',
  driver_name: '',
  weight_tons: 0,
  distance_km: 0,
  rate_per_ton: 0,
  total_revenue: 0,
  advance_paid: 0,
  balance_due: 0,
};

const SELECT_CLASS = 'w-full min-w-[120px] border rounded-md px-2 py-1.5 text-sm bg-white';

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [routes, setRoutes] = useState<{ route_name: string; origin: string; destination: string; distance_km: number; standard_rate_per_ton: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTrip);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [parsedTrips, setParsedTrips] = useState<ParsedTripRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterRoute, setFilterRoute] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = useDebouncedValue(searchInput);
  const [summary, setSummary] = useState({ count: 0, revenue: 0, weight: 0 });

  const hasActiveFilters = filterMonth !== currentMonth || !!filterDateFrom || !!filterDateTo || !!filterVehicle || !!filterRoute || !!filterDriver || !!searchQuery;

  function clearFilters() {
    setFilterMonth(currentMonth);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterVehicle('');
    setFilterRoute('');
    setFilterDriver('');
    setSearchInput('');
  }

  const activeFilterLabels: string[] = [];
  if (searchQuery) {
    activeFilterLabels.push('All dates (search)');
  } else if (filterMonth) {
    const d = new Date(filterMonth + '-01');
    activeFilterLabels.push(d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
  } else if (!filterDateFrom && !filterDateTo) {
    activeFilterLabels.push('All months');
  }
  if (filterDateFrom) activeFilterLabels.push('From: ' + filterDateFrom);
  if (filterDateTo) activeFilterLabels.push('To: ' + filterDateTo);
  if (filterVehicle) activeFilterLabels.push('Vehicle: ' + filterVehicle);
  if (filterRoute) activeFilterLabels.push('Route: ' + filterRoute);
  if (filterDriver) activeFilterLabels.push('Driver: ' + filterDriver);
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
    filterMonth, filterDateFrom, filterDateTo, filterVehicle, filterRoute, filterDriver, searchQuery,
  ]);

  function applyTripFilters<Q>(query: Q): Q {
    let q = query as {
      eq: (col: string, val: string) => typeof q;
      gte: (col: string, val: string) => typeof q;
      lte: (col: string, val: string) => typeof q;
      or: (filter: string) => typeof q;
    };
    if (filterVehicle) q = q.eq('vehicle_number', filterVehicle);
    if (filterRoute) q = q.eq('route_name', filterRoute);
    if (filterDriver) q = q.eq('driver_name', filterDriver);
    const isSearching = searchQuery.trim().length > 0;
    if (!isSearching) {
      if (filterMonth) {
        const [y, m] = filterMonth.split('-');
        const start = `${y}-${m}-01`;
        const end = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
        q = q.gte('date', start).lte('date', end);
      } else {
        if (filterDateFrom) q = q.gte('date', filterDateFrom);
        if (filterDateTo) q = q.lte('date', filterDateTo);
      }
    }
    const searchFilter = buildTextSearchFilter([...TRIP_SEARCH_COLUMNS], searchQuery);
    if (searchFilter) q = q.or(searchFilter);
    return q as Q;
  }

  async function fetchTrips() {
    setLoading(true);
    const { from, to } = getSupabaseRange(page, pageSize);

    let listQuery = applyTripFilters(
      supabase.from('trips').select('*', { count: 'exact' }).order('date', { ascending: false }),
    );
    const { data, count, error } = await listQuery.range(from, to);

    const summaryQuery = applyTripFilters(supabase.from('trips').select('total_revenue, weight_tons'));
    const { data: summaryRows, error: summaryError } = await summaryQuery;

    if (error) { toast.error('Failed to load trips: ' + error.message); setLoading(false); return; }
    if (summaryError) { toast.error('Failed to load trip summary: ' + summaryError.message); }

    setTrips(data || []);
    setTotalTrips(count ?? 0);
    setSummary({
      count: count ?? 0,
      revenue: (summaryRows || []).reduce((s, t) => s + Number(t.total_revenue), 0),
      weight: (summaryRows || []).reduce((s, t) => s + Number(t.weight_tons), 0),
    });
    setLoading(false);
  }

  useEffect(() => {
    fetchTrips();
  }, [page, pageSize, filterMonth, filterDateFrom, filterDateTo, filterVehicle, filterRoute, filterDriver, searchQuery]);

  useEffect(() => {
    supabase.from('vehicles').select('vehicle_number').then(({ data }) => {
      setVehicles((data || []).map((v: { vehicle_number: string }) => v.vehicle_number));
    });
    supabase.from('drivers').select('name').order('name').then(({ data }) => {
      setDrivers((data || []).map((d: { name: string }) => d.name));
    });
    supabase.from('routes').select('route_name, origin, destination, distance_km, standard_rate_per_ton').then(({ data }) => {
      setRoutes(data || []);
    });
  }, []);

  function resetFormDialog() {
    setEditingId(null);
    setForm(emptyTrip);
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
        const updated = recalcTripRow({ ...row, ...patch }, { vehicles, drivers, routes });
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
    const payload = ready.map(({ rowId, complete, missingFields, ...trip }) => trip);
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
    setForm((f) => ({
      ...f,
      route_name: routeName,
      distance_km: route ? Number(route.distance_km) : f.distance_km,
      rate_per_ton: route ? Number(route.standard_rate_per_ton) : f.rate_per_ton,
      total_revenue: f.weight_tons * (route ? Number(route.standard_rate_per_ton) : f.rate_per_ton),
    }));
  }

  function recalcRevenue(weight: number, rate: number) {
    setForm((f) => ({ ...f, weight_tons: weight, rate_per_ton: rate, total_revenue: weight * rate }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      const { error } = await supabase.from('trips').update(form).eq('id', editingId);
      if (error) { toast.error(error.message); return; }
      toast.success('Trip updated');
    } else {
      const { error } = await supabase.from('trips').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Trip added');
    }
    resetFormDialog();
    fetchTrips();
  }

  function startEdit(trip: Trip) {
    setEditingId(trip.id);
    setForm({
      date: trip.date,
      vehicle_number: trip.vehicle_number,
      route_name: trip.route_name,
      driver_name: trip.driver_name,
      weight_tons: Number(trip.weight_tons),
      distance_km: Number(trip.distance_km),
      rate_per_ton: Number(trip.rate_per_ton),
      total_revenue: Number(trip.total_revenue),
      advance_paid: Number(trip.advance_paid),
      balance_due: Number(trip.balance_due),
    });
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trip Log"
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: 'Search vehicle, route, driver...',
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        clearFiltersLabel="Reset filters"
        filterLabels={activeFilterLabels}
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

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500">Trips</p>
            <p className="text-xl font-bold text-gray-900">{summary.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500">Total Weight</p>
            <p className="text-xl font-bold text-gray-900">{summary.weight.toFixed(2)} T</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary.revenue)}</p>
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
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Vehicle</label>
                  <select className={FILTER_SELECT_CLASS} value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                    <option value="">All</option>
                    {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Route</label>
                  <select className={FILTER_SELECT_CLASS} value={filterRoute} onChange={(e) => setFilterRoute(e.target.value)}>
                    <option value="">All</option>
                    {routes.map((r) => <option key={r.route_name} value={r.route_name}>{r.route_name}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Driver</label>
                  <select className={FILTER_SELECT_CLASS} value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)}>
                    <option value="">All</option>
                    {drivers.map((d) => <option key={d} value={d}>{d}</option>)}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <Label>Total Revenue</Label>
                <Input type="number" step="0.01" value={form.total_revenue || ''} onChange={(e) => setForm({ ...form, total_revenue: Number(e.target.value) })} required />
              </div>
              <div>
                <Label>Advance Paid</Label>
                <Input type="number" step="0.01" value={form.advance_paid || ''} onChange={(e) => setForm({ ...form, advance_paid: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Balance Due</Label>
                <Input type="number" step="0.01" value={form.balance_due || ''} onChange={(e) => setForm({ ...form, balance_due: Number(e.target.value) })} />
              </div>
            </div>
            <Button type="submit" className="w-full">{editingId ? 'Update' : 'Add'} Trip</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Rate/Ton</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : trips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">No trips found</TableCell>
                  </TableRow>
                ) : (
                  trips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell>{formatDate(trip.date)}</TableCell>
                      <TableCell><Badge variant="outline">{trip.vehicle_number}</Badge></TableCell>
                      <TableCell>{trip.route_name}</TableCell>
                      <TableCell>{trip.driver_name}</TableCell>
                      <TableCell className="text-right">{Number(trip.weight_tons).toFixed(2)} T</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(trip.rate_per_ton))}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatCurrency(Number(trip.total_revenue))}</TableCell>
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
                  ))
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
